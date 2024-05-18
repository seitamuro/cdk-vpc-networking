import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CdkVpcNetworkingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const peerVpc = new ec2.Vpc(this, "PeerVpc", {
      cidr: "10.101.0.0/16",
      enableDnsHostnames: true,
      enableDnsSupport: true,
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: "PublicSubnet",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
          reserved: false,
        },
      ],
    });
    const vpc = new ec2.Vpc(this, "VPC", {
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
      enableDnsHostnames: true,
      enableDnsSupport: true,
      maxAzs: 2,
      subnetConfiguration: [
        {
          name: "PublicSubnet",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
          reserved: false,
        },
      ],
    });

    const securityGroup = new ec2.SecurityGroup(this, "SampleSecurityGroup", {
      vpc,
      securityGroupName: "cdk-vpc-ec2-security-group",
    });

    const instanceRole = new iam.Role(this, "SampleInstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "AmazonSSMManagedInstanceCore"
        ),
      ],
      description: "cdk-vpc-ec2-instance-role",
    });

    const instance1 = createInstance(
      this,
      "SampleInstance1",
      "cdk-vpc-ec2-instance1",
      vpc,
      vpc.selectSubnets({ subnetType: ec2.SubnetType.PUBLIC }),
      securityGroup,
      instanceRole
    );

    const instance2 = createInstance(
      this,
      "SampleInstance2",
      "cdk-vpc-ec2-instance2",
      vpc,
      vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS }),
      securityGroup,
      instanceRole
    );

    new cdk.CfnOutput(this, "VPC", { value: vpc.vpcId });
    new cdk.CfnOutput(this, "SecurityGroup", {
      value: securityGroup.securityGroupId,
    });
    new cdk.CfnOutput(this, "EC2Instance1", { value: instance1.instanceId });
    new cdk.CfnOutput(this, "EC2Instance2", { value: instance2.instanceId });
  }
}

const createInstance = (
  scope: Construct,
  id: string,
  name: string,
  vpc: ec2.Vpc,
  subnet: ec2.SubnetSelection,
  securityGroup: ec2.SecurityGroup,
  role: iam.Role
): ec2.Instance => {
  return new ec2.Instance(scope, id, {
    vpc,
    vpcSubnets: subnet,
    instanceType: new ec2.InstanceType("t2.micro"),
    machineImage: ec2.MachineImage.latestAmazonLinux2023(),
    securityGroup,
    role,
    instanceName: name,
  });
};
