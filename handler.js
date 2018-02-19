'use strict';

const Coinmarketcap = require('node-coinmarketcap-api');
const AWS = require('aws-sdk');

const coinmarketcap = new Coinmarketcap();
const dynamoDb = new AWS.DynamoDB.DocumentClient();

const ASSET_ID = 'dogecoin';

const priceInfo = (priceUsd) => {
  const timestamp = new Date().getTime();
  return {
    priceUsd,
    createdAt: timestamp
  };
};

// Insert individual price row
const submitPriceP = (price) => {
  console.log('Submitting price');
  const priceInsert = {
    TableName: process.env.DOGE_PRICE_TABLE,
    Item: price
  };
  return dynamoDb.put(priceInsert).promise();
};

// Insert ticker results into new price entries
const updatePrices = (prices) => {
  console.log(`prices ${JSON.stringify(prices)}`);
  const priceUpdates = [];

  prices.forEach((price) => {
    priceUpdates.push(submitPriceP(priceInfo(parseFloat(price.price_usd))));
  });

  return Promise.all(priceUpdates);
};

const getLatestPrice = (assetId) => {
  const params = {
    TableName: process.env.DOGE_PRICE_TABLE,
    Limit: 1,
    ScanIndexForward: false,
    ProjectionExpression: 'priceUsd'
  };

  return dynamoDb.scan(params).promise();
};

module.exports.updatePrice = (event, context) => {
  console.log('Running dogecoin-tracker updatePrice');
  console.log(`event ${JSON.stringify(event)}`);
  console.log(`context ${JSON.stringify(context)}`);

  const promises = [[ASSET_ID], coinmarketcap.ticker(null, null, 0)];

  coinmarketcap.ticker(null, null, 0)
    .then((prices) => {
      return prices.filter(price => price.id === ASSET_ID);
    })
    .then(prices => updatePrices(prices))
    .then(() => console.log('Successfully updated each price'))
    .catch(err => console.log('coinmarketcap ticker:', err));
};

module.exports.getPrice = (event, context, callback) => {
  getLatestPrice(ASSET_ID).then(result => {
    const priceUsd = (result.Items.length > 0) ? result.Items[0].priceUsd : 0;
    const response = {
      statusCode: 200,
      body: JSON.stringify({
        price: priceUsd,
      }),
    };
    callback(null, response);
  }).catch(err => console.log('get price error:', err));
};
