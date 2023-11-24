import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { MusifyreDeployment } from "../lib/emrdeploy";

const app = new cdk.App();

new MusifyreDeployment(
  app,
  "EMRDeploymentStack",
  {
    repovars: {
      connectionArn:
        "arn:aws:codestar-connections:us-east-1:423929911942:connection/1440cadb-91c6-4da7-8b01-23086f246a6e",
    },
    acctvars: [
      {
        stage: "beta",
        account: "423929911942",
        region: "us-east-1",
      },
      {
        stage: "gamma",
        account: "423929911942",
        region: "us-east-1",
      },
      {
        stage: "prod",
        account: "423929911942",
        region: "us-east-1",
      },
    ],
    cavars: {
      domain: "elian",
      repo: "elian-test",
    },
  },
  {
    env: {
      account: "423929911942",
      region: "us-east-1",
    },
  },
);
