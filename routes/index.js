var express = require('express');
var router = express.Router();
var archiver = require('archiver');
var querystring = require("querystring");
var basex = require('basex');
var cheerio = require('cheerio')
var client = new basex.Session("127.0.0.1", 1984, "admin", "admin");
client.execute("OPEN Colenso");

/* Load Homepage/Browser */
router.get('/', function(req, res, next) {
    path = req.query.path;
    if (!path)
        path = ''

    // Doesn't work 100% yet
    client.execute("xquery db:list('Colenso', '"+path+"')",
        function(error, result) {
            if(error) {
                console.error(error);
            } else{
                subDirectories = result.result.split("\n");
                fileNames = [];
                urlPaths = [];

                breadCrumbs = path.split("/");
                breadCrumbs.unshift("Home");
                
                for (x = 0; x < subDirectories.length; x++){
                    pathFolders = subDirectories[x].replace(path, "").split("/")[0];
                    // If fileNames does not contain the current folder/file
                    if (fileNames.indexOf(pathFolders) < 0){
                        if (pathFolders.indexOf(".xml") < 0)// if (pathFolders.length > 4 && pathFolders.substring(pathFolders.length-4, pathFolders.length) == ".xml" )
                            urlPaths.push("/?path=" + path + pathFolders + "/");
                        else
                            urlPaths.push("/doc/?v=" + path + pathFolders);
                        fileNames.push(pathFolders);
                    }
                }

                res.render('index', { title: 'Colenso Project', files: fileNames, urls: urlPaths, crumbs: breadCrumbs});
            }
        });
});

router.get('/doc/', function(req, res, next) {

    text = "Colenso/" + req.query.v;
    console.log("Doc " + text);
    client.execute("XQUERY doc('"+ text +"')",
        function(error, result) {
            if(error) {
                console.error(error);
            } else{
                //console.log(next.toString);
                subDirectories = result.result;//.match(/[^\r\n\s]+/g);
                isEditting = req.query.edit;
                if (!isEditting)
                    isEditting = "False"
                res.render('file', { title: 'Colenso Project', words: subDirectories, downloadPath: req.query.v, viewingFile: req.query.v});
            }
        });
});

/*
 ABC AND 123 - document must contain both "ABC" and "123"
 ABC OR 123 - document can contain either "ABC" and "123"
 ABC NOT 123 - document must contain "ABC" but not "123"

 Order - NOT, OR, AND

 http://stackoverflow.com/questions/14955164/xquery-full-text-search-with-word1-and-not-word2
 */
function getSubSearch(string){
    var outString = '("';
    var spaceSplit = string.split(/\s/g);
    for (y = 0; y < spaceSplit.length; y++){
        if (spaceSplit[y] == "NOT"){
            if (y < spaceSplit.length) {
                outString += '") ftnot ("';
            }
        } else if (spaceSplit[y] == "AND"){
            if (y < spaceSplit.length) {
                outString += '") ftand ("';
            }
        } else if (spaceSplit[y] == "OR"){
            if (y < spaceSplit.length) {
                outString += '") ftor ("';
            }
        } else {
            outString += spaceSplit[y];
        }
    }
    outString += '")';
    return outString;
}
function getStringFromNestedSearch(pastSearch, currentSearch){
    var stringSearch = '(';//'';

    if (pastSearch.length > 0) {
        for (x = 0; x < pastSearch.length; x++) {
            // Joins past searches together
            stringSearch += '(' + getSubSearch(pastSearch[x]);
            if (currentSearch || x < pastSearch.length - 1)
                stringSearch += ') ftand ';
        }
    }

    if (currentSearch.length > 0){
        stringSearch += '(' + getSubSearch(currentSearch) + ')) using wildcards';
    } else {
        stringSearch += ')) using wildcards';
    }
    console.log("Searching for : " + stringSearch + "  :  " + currentSearch);
    return stringSearch;
}

router.get('/search', function(req, res, next) {
    var path = req.query.searchString;
    var pastSearch = req.query.nested;
    page = req.query.page;
    //console.log("Path: " + path)
    if (!path && !pastSearch){
        res.render('search', { title: 'Colenso Project', files: [], downloadPath: '', nested: [], didSearch: false});
    }
    else {
        // 'blah' ftand 'foo'
        // ftor, ftnot
        /*
         client.execute("XQUERY declare namespace tei= 'http://www.tei-c.org/ns/1.0'; " +
         "for $n in (.//tei:"+path+")\n" +
         "return db:path($n)",
         */
        // Need to be easy to do "search 1" AND "search 2" AND "search3"

        var stringSearch = getStringFromNestedSearch(pastSearch? pastSearch : "", path? path : "");
        var stringNested = [];

        if (pastSearch) {
            stringNested = pastSearch;
        }

        if (path){
            stringNested.push(path);
        }
        client.execute("XQUERY declare namespace tei= 'http://www.tei-c.org/ns/1.0'; " +
            "for $n in (//tei:p[text() contains text " + stringSearch + "])\n" +
            "return db:path($n)",
            function(error, result) {
                if(error) {
                    console.error(error);
                } else{
                    if (!page){
                        page = 0;
                    } else {
                        page = Number(page) - 1;
                    }

                    var subDirectories = result.result.split("\n");
                    if (result.result.length == 0){
                        subDirectories = [];
                    }


                    var fileNames = [];
                    //console.error("page: " + page);
                    perPage = 50;

                    var downloadAll = "?" + querystring.stringify({files : subDirectories}, '&', '[]=');
                    console.log("Search " + downloadAll)
                    for (x = 0; x < subDirectories.length; x++){
                        if (fileNames.indexOf(subDirectories[x]) < 0){
                            fileNames.push(subDirectories[x]);
                            //downloadAll += x == 0? "?files[]=" : "&files[]=";
                            //downloadAll += querystring.parse(subDirectories[x]);
                        }
                    }
                    console.log(downloadAll);
                    totalPages = Math.max(1, Math.ceil((fileNames.length+1)/perPage));
                    paginationStuff = [1, totalPages];
                    /*if (totalPages <= 10)
                        paginationStuff = [1, totalPages];
                    else {
                        var offset = 0;
                        if (page < 4){
                            offset = 4 - page;
                        }
                        if (page > totalPages - 6){
                            offset = totalPages - page - 6;
                        }
                        paginationStuff = [Math.max(1, page - 4 - offset), Math.min(fileNames.length / perPage, page + 6 + offset) ];
                    }*/

                    //console.log("pagi: " + (fileNames.length/perPage-1) + "   :   " + paginationStuff + "  :  total Results: " +fileNames.length);
                    url = req.url.replace(/&page=([0-9]+)/g, '');
                    res.render('search', { title: 'Colenso Project', files: fileNames, pageNum: page, resultsPerPage: perPage, baseURL: url, pagiRange: paginationStuff, downloadPath: path, nested: stringNested, 
                        didSearch: true, downloading: downloadAll});
                }
            });
    }
});

router.get('/upload', function(req, res, next) {
    var folder = req.query.folder;
    var newDoc = req.query.newDoc;
    outcome = "Upload";
    if (req.files && req.files.newDoc)
        console.log(req.files.newDoc);
    
    if (newDoc)
        outcome = "Success";
    res.render('upload', { title: 'Colenso Project', result: outcome});
});

// Uploading And Downloading Files Methods
router.post('/uploadDoc', function(req, res, next) {
    console.log("Did something");
    client.execute("REPLACE " + req.query.dir + "/" + req.query.name + " " + req.query.body,
        function(error, result) {
            if (error) {
                console.error(error);
            } else {
                console.log(req.query.p + " updated");
            }
        });
});

router.post('/updateDoc', function(req, res, next) {
    client.execute("REPLACE " + req.query.p + " " + req.query.t,
        function(error, result) {
            if (error) {
                console.error(error);
            } else {
                console.log(req.query.p + " updated");
            }
        });
});

router.get('/downloadDoc', function(req, res) {
    var path = req.query.d;
    var filename = path.split('/');

    client.execute("XQUERY doc('Colenso/"+ path +"')",
        function(error, result) {
            if(error) {
                console.error("error:" + error);
            } else{
                console.log("Downloading " + filename[filename.length-1]);

                //http://stackoverflow.com/questions/18467620/dynamically-creating-a-file-with-node-js-and-make-it-available-for-download
                res.setHeader('Content-disposition', 'attachment; filename=' + filename[filename.length-1]);
                res.setHeader('Content-type', 'text/plain');
                res.charset = 'UTF-8';
                res.write(result.result);
                res.end();
            }
        });
});

router.get('/downloadAll', function(req, res) {
    var pastSearch = req.query.nested;
    var stringSearch = getStringFromNestedSearch(pastSearch? pastSearch : "", "");
    client.execute("XQUERY declare namespace tei= 'http://www.tei-c.org/ns/1.0'; " +
        "for $n in (//tei:p[text() contains text " + stringSearch + "])\n" +
        "return <zip><filepath>{db:path($n)}</filepath><data>{fn:doc(concat('Colenso/', db:path($n)))}</data></zip>",
        function(error, result) {
            if(error) {
                console.error(error);
            } else {
                var subDirectories = result.result.split("\n");
                if (result.result.length == 0){
                    subDirectories = [];
                }
                console.log("so far so good");
                var $ = cheerio.load(result.result);

                var filepaths = []
                $('filepath').each(function(i, elem) {
                    filepaths.push($(this).html());
                });

                var body = []
                $('data').each(function(i, elem) {
                    body.push($(this).html());
                });

                var archive = archiver.create('zip', {});
                res.setHeader('Content-disposition', 'attachment; filename=files.zip');
                res.setHeader('Content-type', 'application/zip');
                console.log("Zipping");

                for (x = 0; x < filepaths.length; x++) {
                    archive.append(body[x], {name: filepaths[x]});
                }

                archive.finalize();
                archive.pipe(res);
                console.log("Downloading file");
            }
        });
});
module.exports = router;
