
import boto3
from botocore.exceptions import ClientError
import os

def create_dynamodb_table():
    """
    Create DynamoDB tables for password manager
    For local development, this uses the local DynamoDB instance
    """
    # Get DynamoDB endpoint from environment variables (or use AWS if not specified)
    endpoint_url = os.environ.get('DYNAMODB_ENDPOINT_URL', None)
    
    # Create DynamoDB client
    dynamodb = boto3.client('dynamodb', endpoint_url=endpoint_url)
    
    # Create UserVault table
    try:
        response = dynamodb.create_table(
            TableName='UserVault',
            KeySchema=[
                {
                    'AttributeName': 'user_id',
                    'KeyType': 'HASH'  # Partition key
                },
                {
                    'AttributeName': 'item_id',
                    'KeyType': 'RANGE'  # Sort key
                }
            ],
            AttributeDefinitions=[
                {
                    'AttributeName': 'user_id',
                    'AttributeType': 'S'
                },
                {
                    'AttributeName': 'item_id',
                    'AttributeType': 'S'
                },
            ],
            ProvisionedThroughput={
                'ReadCapacityUnits': 5,
                'WriteCapacityUnits': 5
            }
        )
        print(f"Table created successfully: {response}")
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceInUseException':
            print(f"Table UserVault already exists")
        else:
            print(f"Error creating table: {e}")
    
    # Create UserDevices table for remembered devices
    try:
        response = dynamodb.create_table(
            TableName='UserDevices',
            KeySchema=[
                {
                    'AttributeName': 'user_id',
                    'KeyType': 'HASH'  # Partition key
                },
                {
                    'AttributeName': 'device_id',
                    'KeyType': 'RANGE'  # Sort key
                }
            ],
            AttributeDefinitions=[
                {
                    'AttributeName': 'user_id',
                    'AttributeType': 'S'
                },
                {
                    'AttributeName': 'device_id',
                    'AttributeType': 'S'
                },
            ],
            ProvisionedThroughput={
                'ReadCapacityUnits': 5,
                'WriteCapacityUnits': 5
            }
        )
        print(f"Table created successfully: {response}")
    except ClientError as e:
        if e.response['Error']['Code'] == 'ResourceInUseException':
            print(f"Table UserDevices already exists")
        else:
            print(f"Error creating table: {e}")

if __name__ == '__main__':
    create_dynamodb_table()
