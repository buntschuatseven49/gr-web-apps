const AWS = require('aws-sdk');

const dynamo = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event, context) => {
  console.log('Received event:', JSON.stringify(event, null, 2));

  let body;
  let statusCode = '200';
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  let params;
  let qs = event.queryStringParameters;

  // https://vdk8qyhmsa.execute-api.eu-west-1.amazonaws.com/PROD/?index_name=index-postleitzahl&rec_art_name=plz1&searchterm=3000

  try {
    switch (event.httpMethod) {
      case "GET":
        let indexName = qs.hasOwnProperty("index_name") ? qs.index_name.toUpperCase() : null;
        let primaryKeyValue = qs.hasOwnProperty("rec_art_name") ? qs.rec_art_name.toUpperCase() : null;
        let searchterm = qs.hasOwnProperty("searchterm") ? qs.searchterm : null;


        if (indexName && primaryKeyValue) {
          params = buildParameters(indexName, primaryKeyValue, searchterm);
        }
        break;
      default:
        params = {
          TableName: "gr_post_adressdaten"
        }

    }
    body = await dynamo.query(params).promise();
  } catch (err) {
    statusCode = '400';
    body = err.message;
  } finally {
    body = JSON.stringify(body);
  }

  return {
    statusCode,
    body,
    headers,
  };
};

function capitalize(str) {
  if(typeof str === 'string') {
      return str.replace(/^\w/, function(c) {
        return c.toUpperCase();
      });
  } else {
      return '';
  }
}
function capitalizeAll(phrase) {
  if (typeof phrase === 'string') {
    return phrase.replace(/\b\w/g, function(c) {
      return c.toUpperCase();
  });
  } else {
    return '';
  }
}
function buildParameters(iName, recArtName, value) {

  let keyConditionExpression = "#prim = :p and #sec = :s";
  let indexName = iName.toUpperCase();
  let secondaryKey = indexName.replace("INDEX-", "");
  let s = capitalizeAll(value);
  let rec_art_name = recArtName.toUpperCase();

  switch (indexName) {
    case "INDEX-POSTLEITZAHL":
      keyConditionExpression = "#prim = :p and #sec = :s";
      s = parseInt(value);
      break;
    case "INDEX-ONRP":
      s = parseInt(value);
      break;

    case "INDEX-ORTBEZ27":
      keyConditionExpression = "#prim = :p and  begins_with(#sec,:s)";
      break;
    // case "INDEX-STRBEZ2L":
    // break;
    // case "INDEX-STRBEZL":
    //   break;
    case "INDEX-STRID":
      s = parseInt(value);
      break;
    default:
      keyConditionExpression = "#prim = :p and #sec = :s";
      break;
  }


  let params = {
    TableName: "gr_post_adressdaten",
    IndexName: iName.toUpperCase(),
    KeyConditionExpression: keyConditionExpression,
    ExpressionAttributeNames: {
      "#prim": "REC_ART_NAME",
      "#sec": secondaryKey
    },
    ExpressionAttributeValues: {
      ":s": s,
      ":p": rec_art_name
    }
  };
  return params;
}