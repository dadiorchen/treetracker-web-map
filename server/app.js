const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const expressLru = require('express-lru');
const Sentry = require('@sentry/node');
const Map = require('./models/Map');
const Tree = require("./models/Tree");
const helper = require("./routeUtils");

Sentry.init({ dsn: null });
const cache = expressLru({
  max: 1000,
  ttl: 60000,
  skip: function(req) {
    // Don't run if bounds passed in, possibly other cases as well
    return !!req.user || !!req.query.bounds;
  }
});
app.use(Sentry.Handlers.requestHandler());
app.use(bodyParser.urlencoded({ extended: false })); // parse application/x-www-form-urlencoded
app.use(bodyParser.json()); // parse application/json
app.set('view engine', 'html');

const allowCrossDomain = (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
}

if(process.env.NODE_ENV == 'dev'){
  app.use(allowCrossDomain);
}

//app.get(/(\/api\/web)?\/trees/, function (req, res) {
app.get("/trees", cache, helper.handlerWrapper(async function (req, res) {
  const map = new Map();
  const beginTime = Date.now();
  await map.init(req.query);
  const response = {};
  response.data = await map.getPoints();
  response.zoomTargets = await map.getZoomTargets();
  console.log("/trees took time:%d ms", Date.now() - beginTime);
  res.status(200).json(response);
}));

app.use(Sentry.Handlers.errorHandler());

//entities API
const entity = require("./api/entity");
//app.use(/(\/api\/web)?\/entities/, entity);
app.use("/entities", entity);

//nearest API
const nearest = require("./api/nearest");
app.use("/nearest", nearest);

app.get("/tree", helper.handlerWrapper(async function (req, res){
  const tree = new Tree();
  const treeId = req.query.tree_id;
  if(!treeId){
    console.warn("no tree id", treeId);
    res.status(400).json({message:"no tree id"});
  }
  const treeDetail = await tree.getTreeById(treeId);
  res.status(200).json(treeDetail);
}));

// Global error handler
app.use(helper.errorHandler);

////add static files, HTML pages
//app.use(express.static(path.join(__dirname, "../client")));
//app.get("/", (req, res) => {
//  res.sendFile(path.join(__dirname, "../client", "index.html"));
//});

//app.listen(port, () => {
//  console.log('listening on port ' + port);
//});
module.exports = app;
