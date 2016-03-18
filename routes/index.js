var express = require('express');
var router = express.Router();
var basex = require('basex');
var client = new basex.Session("127.0.0.1", 1984, "admin", "admin");
client.execute("OPEN Colenso");

// localhost:3000/?path=Hadfield
/* GET home page. */
router.get('/', function(req, res, next) {
  path = req.query.path;
  if (!path)
    path = ''

  client.execute("xquery db:list('Colenso', '"+path+"')",
  function(error, result) {
    if(error) {
      console.error(error);
    } else{
      arrayOfLines = result.result.toString().split("\n");
      filePath = [];
      urlPath = [];
      breadCrumbs = path.split("/");
      breadCrumbs.unshift("Home");
      for (x = 0; x < arrayOfLines.length; x++){
	arrayTest = arrayOfLines[x].replace(path, "").split("/");
	if (filePath.indexOf(arrayTest[0]) < 0){
	  if (arrayTest[0].length > 4 && arrayTest[0].substring(arrayTest[0].length-4, arrayTest[0].length) == ".xml" )
	    urlPath.push("/s=" + path + arrayTest[0]);
	  else
	    urlPath.push("/?path=" + path + arrayTest[0] + "/");
	  filePath.push(arrayTest[0]);
	}
      }

      res.render('index', { title: 'Colenso Project', files: filePath, urls: urlPath, crumbs: breadCrumbs});
    }
  });
});

router.get('/s=*', function(req, res, next) {
  text = "Colenso/" + req.url.replace("/s=", "");
  client.execute("XQUERY doc('"+ text +"')",
  function(error, result) {
    if(error) {
      console.error(error);
    } else{
     
      arrayOfLines = result.result;//.match(/[^\r\n\s]+/g);
      res.render('file', { title: 'Colenso Project', words: arrayOfLines, downloadPath: text});
    }
  });
});

router.get('/d=*', function(req, res) {
  path = __dirname.replace("MiniProject/routes", "") + req.url.replace("/d=", "");
  res.download(path);
  console.log(path);
});

router.get('/q=*', function(req, res, next) {
  /*text = "Colenso/" + req.url.replace("/s=", "");
  client.execute("XQUERY doc('"+ text +"')",
  function(error, result) {
    if(error) {
      console.error(error);
    } else{
     
      arrayOfLines = result.result;//.match(/[^\r\n\s]+/g);
      res.render('file', { title: 'Express', words: arrayOfLines, downloadPath: text});
    }
  });*/
  res.render('search', { title: 'Colenso Project'});
});

module.exports = router;
