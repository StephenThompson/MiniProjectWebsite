var express = require('express');
var router = express.Router();
var basex = require('basex');
var client = new basex.Session("127.0.0.1", 1984, "admin", "admin");
client.execute("OPEN Colenso");

/* GET home page. */
router.get('/', function(req, res, next) {
  client.execute("LIST Colenso",
  function(error, result) {
    if(error) {
      console.error(error);
    } else{
      arrayOfLines = result.result.match(/[^\r\n\s]+/g);
      res.render('index', { title: 'Express', words: arrayOfLines});
    }
  });
});

module.exports = router;
