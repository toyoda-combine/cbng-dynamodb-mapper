import {
  DeleteBackupCommandOutput,
  DynamoDBClient,
  DynamoDBClientConfig,
  QueryCommand,
} from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  BatchWriteCommandOutput,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  PutCommandOutput,
  QueryCommandInput,
  QueryCommandOutput,
  TranslateConfig,
} from "@aws-sdk/lib-dynamodb";
import { chunk } from "@/util";

type Key = Record<string, any>;
type Item = Record<string, any>;
type Attribute = { name: string; value: any };

export class CbngDynamoDBClient {
  private static defaultTranslateConfig(): TranslateConfig {
    return {
      marshallOptions: {
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
      },
    };
  }

  private static convAttribute(attribute: Attribute) {
    const AltExpressionAttributeName = `#${attribute.name}`;
    const AltExpressionAttributeValue = `:${attribute.name}`;
    return {
      AltExpressionAttributeName,
      AltExpressionAttributeValue,
      ExpressionAttributeName: {
        [AltExpressionAttributeName]: attribute.name,
      },
      ExpressionAttributeValue: {
        [AltExpressionAttributeValue]: attribute.value,
      },
    };
  }

  private tableName: string;
  private client: DynamoDBClient;
  private docClient: DynamoDBDocumentClient;

  constructor(
    tableName: string,
    configuration: DynamoDBClientConfig,
    translateConfig: TranslateConfig = CbngDynamoDBClient.defaultTranslateConfig()
  ) {
    this.tableName = tableName;
    this.client = new DynamoDBClient(configuration);
    this.docClient = DynamoDBDocumentClient.from(this.client, translateConfig);
  }

  async getItem(Key: Key): Promise<Item | null> {
    const command = new GetCommand({ TableName: this.tableName, Key });
    const { Item } = await this.docClient.send(command);
    return Item ?? null;
  }

  async putItem(Item: object): Promise<PutCommandOutput> {
    return await this.docClient.send(
      new PutCommand({ TableName: this.tableName, Item })
    );
  }

  async deleteItem(Key: Key): Promise<DeleteBackupCommandOutput> {
    return await this.docClient.send(
      new DeleteCommand({ TableName: this.tableName, Key })
    );
  }

  async batchWriteItem(
    Items: object[],
    chunkSize = 10
  ): Promise<BatchWriteCommandOutput[]> {
    const result: BatchWriteCommandOutput[] = [];
    for (const chunked of chunk(Items, chunkSize)) {
      const requestItemsValues = chunked.map((Item) => ({
        PutRequest: { Item },
      }));
      result.push(
        await this.docClient.send(
          new BatchWriteCommand({
            RequestItems: { [this.tableName]: requestItemsValues },
          })
        )
      );
    }
    return result;
  }

  async query(input: QueryCommandInput, limit = Infinity): Promise<Item[]> {
    const result: Item[] = [];
    let output: QueryCommandOutput;
    let ExclusiveStartKey: Item | undefined = undefined;
    for (;;) {
      output = await this.docClient.send(
        new QueryCommand({ ...input, ExclusiveStartKey })
      );
      if (output.Items == null || output.LastEvaluatedKey == null) break;
      result.push(...output.Items);
      if (result.length > limit) return result.slice(0, limit);
      ExclusiveStartKey = output.LastEvaluatedKey;
    }
    if (output.Items != null) result.push(...output.Items);
    return result.slice(0, limit);
  }

  async queryByPrimaryKey(pKey: Attribute): Promise<Item[]> {
    const expression = CbngDynamoDBClient.convAttribute(pKey);
    return await this.query({
      TableName: this.tableName,
      KeyConditionExpression: `${expression.AltExpressionAttributeName}=${expression.AltExpressionAttributeValue}`,
      ExpressionAttributeNames: expression.ExpressionAttributeName,
      ExpressionAttributeValues: expression.ExpressionAttributeValue,
    });
  }

  async queryByPrimaryKeyAndSortKey(
    pKey: Attribute,
    sKey: Attribute,
    options?: { IndexName?: string }
  ): Promise<Item[]> {
    const pKeyExpression = CbngDynamoDBClient.convAttribute(pKey);
    const sKeyExpression = CbngDynamoDBClient.convAttribute(sKey);
    return await this.query({
      TableName: this.tableName,
      IndexName: options?.IndexName,
      KeyConditionExpression: `${pKeyExpression.ExpressionAttributeName}=${pKeyExpression.ExpressionAttributeValue} AND begins_with(${sKeyExpression.ExpressionAttributeName}, ${sKeyExpression.ExpressionAttributeValue})`,
      ExpressionAttributeNames: {
        ...pKeyExpression.ExpressionAttributeName,
        ...sKeyExpression.ExpressionAttributeName,
      },
      ExpressionAttributeValues: {
        ...pKeyExpression.ExpressionAttributeValue,
        ...sKeyExpression.ExpressionAttributeValue,
      },
    });
  }

  searchByPKey = async (
    pKey: Attribute,
    condition?: { [key: string]: string | number | boolean | undefined }
  ): Promise<Item[]> => {
    let FilterExpression: string | undefined = undefined;
    let ExpressionAttributeNames: QueryCommandInput["ExpressionAttributeNames"] =
      {};
    let ExpressionAttributeValues: QueryCommandInput["ExpressionAttributeValues"] =
      {};
    for (const [name, value] of Object.entries(condition ?? {})) {
      if (value != null) {
        if (typeof FilterExpression == "undefined") FilterExpression = "";
        if (FilterExpression.length > 0) FilterExpression += " AND ";
        const expression = CbngDynamoDBClient.convAttribute({
          name,
          value,
        });
        FilterExpression += `contains(${expression.AltExpressionAttributeName}, ${expression.AltExpressionAttributeValue})`;
        ExpressionAttributeNames = {
          ...ExpressionAttributeNames,
          ...expression.ExpressionAttributeName,
        };
        ExpressionAttributeValues = {
          ...ExpressionAttributeValues,
          ...expression.ExpressionAttributeValue,
        };
      }
    }

    const pKeyExpression = CbngDynamoDBClient.convAttribute(pKey);

    return await this.query({
      TableName: this.tableName,
      KeyConditionExpression: `${pKeyExpression.AltExpressionAttributeName}=${pKeyExpression.AltExpressionAttributeValue}`,
      FilterExpression,
      ExpressionAttributeNames: {
        ...ExpressionAttributeNames,
        ...pKeyExpression.ExpressionAttributeName,
      },
      ExpressionAttributeValues: {
        ...ExpressionAttributeValues,
        ...pKeyExpression.ExpressionAttributeValue,
      },
    });
  };
}
