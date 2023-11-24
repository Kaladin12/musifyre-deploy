import { Construct } from "constructs";
import {
  aws_codeartifact as codeartifact,
  Stack,
  StackProps,
  Stage,
} from "aws-cdk-lib";
import {
  CodePipeline,
  CodePipelineSource,
  ManualApprovalStep,
  ShellStep,
} from "aws-cdk-lib/pipelines";
import { MusifyreCdkStack } from "musifyre-cdk";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import * as events from "aws-cdk-lib/aws-events-targets";
import { Rule } from "aws-cdk-lib/aws-events";
import { LinuxBuildImage } from "aws-cdk-lib/aws-codebuild";

export interface RepoVars {
  readonly connectionArn: string;
}

export interface AcctVars {
  readonly stage: string;
  readonly account: string;
  readonly region: string;
}

export interface CodeArtifactVars {
  readonly domain: string;
  readonly repo: string;
}

export interface DeploymentVars {
  readonly repovars: RepoVars;
  readonly acctvars: AcctVars[];
  readonly cavars: CodeArtifactVars;
}

class MusifyreStage extends Stage {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id);

    new MusifyreCdkStack(this, "MusifyreMainStack", {
      stackName: "MusifyreMainStack",
      env: {
        account: props.env?.account,
        region: props.env?.region,
      },
    });
  }
}

export class MusifyreDeployment extends Stack {
  constructor(
    scope: Construct,
    id: string,
    emrvars: DeploymentVars,
    props?: StackProps,
  ) {
    super(scope, id, props);

    const pipeline = new CodePipeline(this, "Pipeline", {
      crossAccountKeys: true,
      useChangeSets: true,
      synth: new ShellStep("Synth", {
        input: CodePipelineSource.connection("Kaladin12/musifyre", "main", {
          connectionArn: emrvars.repovars.connectionArn,
        }),
        commands: [
          "cd musifyre-cdk",
          `aws codeartifact login --tool npm --domain ${emrvars.cavars.domain} --repository ${emrvars.cavars.repo}`,
          "npm update -g npm@latest",
          "npm -v",
          "npm install",
          "npm list --depth=0",
          "npm run build",
          "npm install -g aws-cdk",
          "npx cdk synth",
        ],
        primaryOutputDirectory: "musifyre-cdk/cdk.out",
      }),
      codeBuildDefaults: {
        buildEnvironment: {
          buildImage: LinuxBuildImage.STANDARD_6_0,
        },
      },
      selfMutationCodeBuildDefaults: {
        rolePolicy: [
          PolicyStatement.fromJson({
            Action: ["cloudformation:*"],
            Effect: "Allow",
            Resource: "*",
          }),
        ],
      },
      synthCodeBuildDefaults: {
        rolePolicy: [
          PolicyStatement.fromJson({
            Action: [
              "codeartifact:Describe*",
              "codeartifact:Get*",
              "codeartifact:List*",
              "codeartifact:ReadFromRepository",
            ],
            Effect: "Allow",
            Resource: "*",
          }),
          PolicyStatement.fromJson({
            Effect: "Allow",
            Action: "sts:GetServiceBearerToken",
            Resource: "*",
            Condition: {
              StringEquals: {
                "sts:AWSServiceName": "codeartifact.amazonaws.com",
              },
            },
          }),
        ],
      },
    });

    emrvars.acctvars.forEach(function (acct) {
      const deployStage = pipeline.addStage(
        new MusifyreStage(
          pipeline,
          "Deploy-" + acct.stage + "-" + acct.account + "-" + acct.region,
          {
            env: {
              account: acct.account,
              region: acct.region,
            },
          },
        ),
      );
      deployStage.addPre(new ManualApprovalStep("Manual Approval"));
    });

    //Required to instantiate actual pipeline for synth
    pipeline.buildPipeline();

    /*const rule: Rule = new Rule(this, "MusifyreTrigger", {
      eventPattern: {
        source: ["aws.codeartifact"],
        detail: {
          packageName: ["musifyre-cdk"],
          packageVersionState: ["Published"],
        },
      },
      targets: [new events.CodePipeline(pipeline.pipeline)],
    });*/
  }
}
