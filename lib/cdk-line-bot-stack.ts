import * as cdk from '@aws-cdk/core'
import * as lambda from '@aws-cdk/aws-lambda'
import * as apigateway from '@aws-cdk/aws-apigateway'
import * as dynamodb from '@aws-cdk/aws-dynamodb'

export class CdkLineBotStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const table = new dynamodb.Table(this, 'Table', {
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING }
    })

    const layer = new lambda.LayerVersion(this, 'layer', {
      compatibleRuntimes: [lambda.Runtime.NODEJS_12_X],
      code: lambda.Code.fromAsset('layer.out'),
    })

    const dbHandler = new lambda.Function(this, 'DbHandlerFunction', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/dbHandler'),
      layers: [layer],
      environment: {
        TABLE_NAME: table.tableName,
      }
    })

    const linebot = new lambda.Function(this, 'LineBotFunction', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/linebot'),
      layers: [layer],
      environment: {
        ACCESS_TOKEN: process.env.ACCESS_TOKEN!,
        CHANNEL_SECRET: process.env.CHANNEL_SECRET!,
        FUNCTION_NAME: dbHandler.functionName,
      }
    })

    dbHandler.grantInvoke(linebot) // Lambdaの呼び出し権限付与

    table.grantFullAccess(dbHandler)  // DynamoDBの操作権限付与

    const api = new apigateway.RestApi(this, 'Api')
    api.root.addMethod('POST', new apigateway.LambdaIntegration(linebot))

  }
}
