var express = require('express');
var router = express.Router();
var JSZip = require("jszip");
const fs = require('fs');
var basex = require('basex');
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
                        if (pathFolders.length > 4 && pathFolders.substring(pathFolders.length-4, pathFolders.length) == ".xml" )
                            urlPaths.push("/s=" + path + pathFolders);
                        else
                            urlPaths.push("/?path=" + path + pathFolders + "/");
                        fileNames.push(pathFolders);
                    }
                }

                res.render('index', { title: 'Colenso Project', files: fileNames, urls: urlPaths, crumbs: breadCrumbs});
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

                subDirectories = result.result;//.match(/[^\r\n\s]+/g);
                res.render('file', { title: 'Colenso Project', words: subDirectories, downloadPath: text});
            }
        });
});

router.get('/d=*', function(req, res) {
    path = __dirname.replace("MiniProject/routes", "") + req.url.replace("/d=", "");
    res.download(path);
    console.log(path);
});

router.get('/search', function(req, res, next) {
    path = req.query.searchString;
    page = req.query.page;
    if (!path){
        res.render('search', { title: 'Colenso Project', files: []});
    }
    else {
        // 'blah' ftand 'foo'
        // ftor, ftnot
        /*
         client.execute("XQUERY declare namespace tei= 'http://www.tei-c.org/ns/1.0'; " +
         "for $n in (.//tei:"+path+")\n" +
         "return db:path($n)",
         */
        client.execute("XQUERY declare namespace tei= 'http://www.tei-c.org/ns/1.0'; " +
            "for $n in (//tei:p[text() contains text '" + path + "'])\n" +
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

                    subDirectories = result.result.split("\n");
                    fileNames = [];
                    console.error("page: " + page);
                    perPage = 50;


                    for (x = 0; x < subDirectories.length; x++){
                        if (fileNames.indexOf(subDirectories[x]) < 0){
                            fileNames.push(subDirectories[x]);
                        }
                    }
                    totalPages = Math.ceil((fileNames.length+1)/perPage);
                    var paginationStuff = [1, totalPages];
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

                    console.log("pagi: " + (fileNames.length/perPage-1) + "   :   " + paginationStuff + "  :  total Results: " +fileNames.length);
                    url = req.url.replace(/&page=([0-9]+)/g, '');
                    res.render('search', { title: 'Colenso Project', files: fileNames, pageNum: page, resultsPerPage: perPage, baseURL: url, pagiRange: paginationStuff, downloadPath: path});
                }
            });
    }
});

router.get('/downloadAll/*', function(req, res) {
    path = req.query.search;

    client.execute("XQUERY declare namespace tei= 'http://www.tei-c.org/ns/1.0'; " +
        "for $n in (//tei:p[text() contains text '" + path + "'])\n" +
        "return db:path($n)",
        function(error, result) {
            if(error) {
                console.error(error);
            } else{
                // Removes duplicates files
                subDirectories = result.result.split("\n");
                fileNames = [];
                for (x = 0; x < subDirectories.length; x++){
                    if (fileNames.indexOf(subDirectories[x]) < 0){
                        fileNames.push(subDirectories[x]);
                    }
                }

                // Creates zip file
                var zip = new JSZip();
                zip.file("hello.txt", "Hello World\n");

                // Downloads zip
                var buffer = zip.generate({type:"nodebuffer"});

                fs.writeFile("test.zip", buffer, function(err) {
                    if (err) throw err;
                });
                console.log(path);
            }
        });
});

router.get('/upload', function(req, res, next) {
    res.render('upload', { title: 'Colenso Project'});
});

module.exports = router;
