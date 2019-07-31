#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/core');
import { WindowsEc2Stack } from '../lib/windows-ec2-stack';

const app = new cdk.App();
new WindowsEc2Stack(app, 'WindowsEc2Stack');
