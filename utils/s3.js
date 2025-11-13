const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const config = require('../config');

const s3Client = new S3Client({ region: config.s3.region });

async function createPresignedUploadUrl({ key, contentType, expiresIn = 900 }) {
  const cmd = new PutObjectCommand({
    Bucket: config.s3.bucket,
    Key: key,
    ContentType: contentType,
    ACL: 'private'
  });
  const url = await getSignedUrl(s3Client, cmd, { expiresIn });
  return url;
}

async function createSignedGetUrl({ key, expiresIn = 3600 }) {
  const cmd = new GetObjectCommand({ Bucket: config.s3.bucket, Key: key });
  const url = await getSignedUrl(s3Client, cmd, { expiresIn });
  return url;
}

async function deleteObject(key) {
  const cmd = new DeleteObjectCommand({ Bucket: config.s3.bucket, Key: key });
  return s3Client.send(cmd);
}

module.exports = { createPresignedUploadUrl, createSignedGetUrl, deleteObject };
