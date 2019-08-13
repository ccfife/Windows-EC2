import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import elbv2 = require('@aws-cdk/aws-elasticloadbalancingv2');
import autoscaling = require('@aws-cdk/aws-autoscaling');

export class WindowsEc2Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a VPC with default values, except with only 1 NAT gateway instead of 1/per subnet
    const vpc = new ec2.Vpc(this, 'VPC', {
      natGateways: 1
    })

    //create an application loadbalancer
    const lb = new elbv2.ApplicationLoadBalancer(this, 'ELB',{
      vpc,
      internetFacing: true
    });

    //create an autoscaling group of Windows Servers with IIS
    const webtier = new autoscaling.AutoScalingGroup(this, 'IIS',{
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
      machineImage: new ec2.WindowsImage(ec2.WindowsVersion.WINDOWS_SERVER_2019_ENGLISH_FULL_BASE),
      minCapacity: 1,
      maxCapacity: 4,
      desiredCapacity: 2,
    });

    //get the current region for use in the UserData script
    const region = this.region;
    
    //install IIS
    //Download and install Chocolately and use it to obtain webdeploy
    //Download and install the CodeDeploy agent from the regional bucket location
    webtier.addUserData(
      'Install-WindowsFeature -Name Web-Server,NET-Framework-45-ASPNET,NET-Framework-45-Core,NET-Framework-45-Features,NET-Framework-Core -IncludeManagementTools',
      `Set-ExecutionPolicy Bypass -Scope Process -Force; iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))`,
      `choco install webdeploy -y`,
      `Read-S3Object -BucketName aws-codedeploy-${region} -Key latest/codedeploy-agent.msi -File c:\\temp\\codedeploy-agent.msi c:\\temp\\codedeploy-agent.msi /quiet /l`, 
      `c:\\temp\\host-agent-install-log.txt`
    )

    
    const datatier = new autoscaling.AutoScalingGroup(this, 'SQL', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.SMALL),
      machineImage: new ec2.WindowsImage(ec2.WindowsVersion.WINDOWS_SERVER_2019_ENGLISH_FULL_SQL_2016_SP2_ENTERPRISE),
      minCapacity: 1,
      maxCapacity: 4,
      desiredCapacity: 2,
    });

    //add a listener to the load balancer on port 80
    const listener = lb.addListener('listener',{
      port: 80,
      open: true,
    });

    //connect the load balancer to the autoscaling group on port 80
    listener.addTargets('targets', {
      targets: [webtier],
      port: 80
    });

    //security group connections
    lb.connections.allowFromAnyIpv4(ec2.Port.tcp(80), 'allow connections to asg from lb');

    //output the load balancer DNS name to the console
    new cdk.CfnOutput(this, 'LoadBalancerDNS', { value: lb.loadBalancerDnsName });
    
  }
}

