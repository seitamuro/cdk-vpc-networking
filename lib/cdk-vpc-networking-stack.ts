import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import { Construct } from "constructs";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class CdkVpcNetworkingStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPCの作成
    const peerVpc = new ec2.Vpc(this, "MyPeerVpc", {
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
    const vpc = new ec2.Vpc(this, "MyVPC", {
      ipAddresses: ec2.IpAddresses.cidr("10.102.0.0/16"),
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
        {
          name: "PrivateSubnet",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
          reserved: false,
        },
      ],
    });

    // VPCピアリング
    const vpcPeeringConnection = new ec2.CfnVPCPeeringConnection(
      this,
      "VpcPeeringConnection",
      {
        vpcId: vpc.vpcId,
        peerVpcId: peerVpc.vpcId,
      }
    );

    // 各VPCのサブネットのルートテーブルにピアリング接続を追加
    peerVpc.publicSubnets.map((iSubnet: ec2.ISubnet, index: number) => {
      new ec2.CfnRoute(this, `PeerVpcRoute${index}`, {
        routeTableId: iSubnet.routeTable.routeTableId,
        destinationCidrBlock: vpc.vpcCidrBlock,
        vpcPeeringConnectionId: vpcPeeringConnection.ref,
      });
    });
    vpc.publicSubnets.map((iSubnet: ec2.ISubnet, index: number) => {
      new ec2.CfnRoute(this, `VpcRoute${index}`, {
        routeTableId: iSubnet.routeTable.routeTableId,
        destinationCidrBlock: peerVpc.vpcCidrBlock,
        vpcPeeringConnectionId: vpcPeeringConnection.ref,
      });
    });

    // EC2インスタンスの作成
    const securityGroup = new ec2.SecurityGroup(this, "SampleSecurityGroup", {
      vpc,
      securityGroupName: "cdk-vpc-ec2-security-group",
    });
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.allIcmp());

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
      peerVpc,
      vpc.selectSubnets({ subnetType: ec2.SubnetType.PUBLIC }),
      securityGroup,
      instanceRole
    );

    const instance3 = createInstance(
      this,
      "SampleInstance3",
      "cdk-vpc-ec2-instance3",
      vpc,
      vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }),
      securityGroup,
      instanceRole
    );
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
