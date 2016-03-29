var express = require('express');
var router = express.Router();
var archiver = require('archiver');
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

 Order - NOT, AND, OR

 http://stackoverflow.com/questions/14955164/xquery-full-text-search-with-word1-and-not-word2
 */
function getSubSearch(string){
    var outString = '(';

    // Deal with AND keyword
    var ORSplit = string.split(/\s+OR\s+/g);
    var orString = '';
    if (ORSplit.length > 1)
        orString = '(';
    for (x = 0; x < ORSplit.length; x++){
        // Deal with AND keyword
        var ANDSplit = ORSplit[x].split(/\s+AND\s+/g);
        var andString = '';
        if (ANDSplit.length > 1)
            andString = '(';
        for (y = 0; y < ANDSplit.length; y++){
            // Deal with NOT keyword
            var NOTSplit = ANDSplit[y].split(/\s+NOT\s+/g);
            var notString = '';
            if (NOTSplit.length > 1)
                notString = '(';
            for (z = 0; z < NOTSplit.length; z++){
                notString += '"' + NOTSplit[z] + '"';
                if (z < NOTSplit.length - 1){
                    notString += " ftand ftnot ";
                }
            }
            if (NOTSplit.length > 1)
                notString += ')';
            andString += notString;
            if (y < ANDSplit.length - 1){
                andString += " ftand ";
            }
        }
        if (ANDSplit.length > 1)
            andString += ')';
        orString += andString;
        if (x < ORSplit.length - 1){
            orString += " ftor ";
        }
    }
    if (ORSplit.length > 1)
        orString += ')';
    // put everything together
    outString += orString;
    outString += ')';
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
        // Need to be easy to do "search 1" AND "search 2" AND "search3"

        var stringSearch = getStringFromNestedSearch(pastSearch? pastSearch : "", path? path : "");
        var stringNested = [];

        if (pastSearch) {
            stringNested = pastSearch;
        }

        if (path){
            stringNested.push(path);
        }
        //"for $n in (//tei:p[text() contains text " + stringSearch + "])\n" + tei
        client.execute("XQUERY declare namespace tei= 'http://www.tei-c.org/ns/1.0'; " +
            "for $n in (//.[. contains text " + stringSearch + "])\n" +
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

                    var subDirectories = result.result.match(/[^\r\n]+/g);
                    if (result.result.length == 0){
                        subDirectories = [];
                    }

                    var fileNames = [];
                    perPage = 50;

                    for (x = 0; x < subDirectories.length; x++){
                        if (fileNames.indexOf(subDirectories[x]) < 0 && subDirectories[x].length > 0){
                            fileNames.push(subDirectories[x]);
                        }
                    }
                    //console.log(fileNames);
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

                    url = req.url.replace(/&page=([0-9]+)/g, '');
                    res.render('search', { title: 'Colenso Project', files: fileNames, pageNum: page, resultsPerPage: perPage, baseURL: url, pagiRange: paginationStuff, downloadPath: path, nested: stringNested, 
                        didSearch: true});
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
    var filename = req.query.name;
    if (filename.substring(filename.length - 4) != ".xml")
        filename += ".xml";
    console.log("REPLACE " + req.query.dir + "/" + req.query.name);
    client.execute("REPLACE " + req.query.dir + "/" + req.query.name + " " + req.query.body,
        function(error, result) {
            if (error) {
                console.error(error);
            } else {
                console.log(req.query.p + " uploaded");
            }
        });
});

router.post('/updateDoc', function(req, res, next) {
    client.execute("REPLACE " + req.query.p + " " + req.query.t,
        function (error, result) {
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

function validateDoc(document){
    return true;
    /*client.execute("xquery "+
        "try {"
    "let $doc := <invalid/>
    "let $schema := '<!ELEMENT root (#PCDATA)>'
    "return validate:dtd($doc, $schema)
""} catch bxerr:BXVA0001 {""
    "'DTD Validation failed.'
"}"
    ,
        function(error, result) {
            if(error) {
                console.error("Is not valid:" + error);
                return false;
            } else{
                console.log("Is valid");
                return true;
            }
        });*/
}
module.exports = router;
