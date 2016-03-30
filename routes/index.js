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
        path = '';

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
    var outString = '';
    console.log("s: " + string);
    // Deal with AND keyword
    var ORSplit = string.split(/\s+OR\s+/g);
    var orString = '';
    for (x = 0; x < ORSplit.length; x++){
        // Deal with AND keyword
        var ANDSplit = ORSplit[x].split(/\s+AND\s+/g);
        var andString = '';

        for (y = 0; y < ANDSplit.length; y++){
            // Deal with NOT keyword
            var NOTSplit = ANDSplit[y].split(/\s+NOT\s+/g);
            var notString = '';
            for (z = 0; z < NOTSplit.length; z++){
                notString += '"' + NOTSplit[z] + '"';
                if (z < NOTSplit.length - 1){
                    notString += " ftand ftnot ";
                }
            }
            if (NOTSplit.length > 1)
                notString = '(' + notString + ')';
            andString += notString;
            if (y < ANDSplit.length - 1){
                andString += " ftand ";
            }
        }
        if (ANDSplit.length > 1)
            andString = '(' + andString + ')';
        orString += andString;
        if (x < ORSplit.length - 1){
            orString += " ftor ";
        }
    }
    if (ORSplit.length > 1)
        orString = '(' + orString + ')';
    // put everything together
    outString += orString;
    return outString;
}
function getStringFromNestedSearch(pastSearch, currentSearch){
    var stringSearch = '(';
    var count = 0;

    while (count < pastSearch.length) {
        // Joins past searches together
        stringSearch += getSubSearch(pastSearch[count]);
        if (currentSearch || count < pastSearch.length - 1) {
            stringSearch += ' ftand ';
        }
        count++;
    }

    if (currentSearch.length > 0){
        stringSearch += getSubSearch(currentSearch);
    }
    stringSearch += ') using wildcards';

    return stringSearch;
}

function getQueryFromNestedSearch(pastSearch, currentSearch){
    var querySearch = "";
    var count = 0;

    while (count < querySearch.length) {
        // Joins past searches together
        querySearch += "[" + pastSearch[count] + "]";
        count++;
    }

    if (currentSearch.length > 0){
        querySearch += "[" + currentSearch + "]";
    }

    return querySearch;
}

router.get('/search', function(req, res, next) {
    var string = req.query.searchString;
    var xquery = req.query.searchQuery;

    var pastQuery = req.query.nestedQuery;
    var pastSearch = req.query.nestedString;

    if (!string && !xquery && !pastSearch && !pastQuery){
        res.render('search', { title: 'Colenso Project', files: [], downloadPath: '', nestedString: [], nestedQuery: [], didSearch: false});
    }
    else {
        page = req.query.page;
        console.log("pastSearch: " + pastSearch);
        console.log("pastQuery: " + pastQuery);
        console.log("s: " + string);
        console.log("q: " + xquery);
        console.log("------------");
        var stringSearch = getStringFromNestedSearch(pastSearch? pastSearch : [], string? string : "");
        var stringNested = [];
        var querySearch = getQueryFromNestedSearch(pastQuery? pastQuery : [], xquery? xquery : "");
        var queryNested = [];

        if (pastSearch) {
            stringNested = pastSearch;
        }
        if (pastQuery) {
            queryNested = pastQuery;
        }

        if (string)
            stringNested.push(string);
        if (xquery)
            queryNested.push(xquery);

        var searchingFor = "XQUERY declare namespace tei= 'http://www.tei-c.org/ns/1.0'; ";
        if (stringSearch)
            searchingFor += "for $n in *[. contains text " + stringSearch + "]";
        else
            searchingFor += "for $n in *";
        searchingFor += querySearch;

        console.log(searchingFor + " return db:path($n)");

        client.execute(searchingFor + "\n return db:path($n)",
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

                    url = req.url.replace(/&page=([0-9]+)/g, '');
                    res.render('search', { title: 'Colenso Project', files: fileNames,
                        pageNum: page,
                        resultsPerPage: perPage,
                        baseURL: url,
                        pagiRange: paginationStuff,
                        nestedString: stringNested,
                        nestedQuery: queryNested,
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
    console.log("REPLACE " + req.query.dir + req.query.name + " " + req.query.body);
    client.execute("REPLACE " + req.query.dir + req.query.name + " " + req.query.body,
        function(error, result) {
            if (error) {
                console.error(error);
            } else {
                console.log(req.query.name + " uploaded");
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
    console.log("Downloading Zip : " + req.query.nested + " : " + req.query.nested);
    var pastQuery = req.query.nestedQuery;
    var pastSearch = req.query.nestedString;
    console.log("Downloading Zip");

    var stringSearch = getStringFromNestedSearch(pastSearch? pastSearch : [], "");
    var querySearch = getQueryFromNestedSearch(pastQuery? pastQuery : [], "");


    var searchingFor = "XQUERY declare namespace tei= 'http://www.tei-c.org/ns/1.0'; ";
    if (stringSearch)
        searchingFor += "for $n in *[. contains text " + stringSearch + "]";
    else
        searchingFor += "for $n in *";
    searchingFor += querySearch;

    client.execute(searchingFor +
        "\n return <zip><filepath>{db:path($n)}</filepath><data>{fn:doc(concat('Colenso/', db:path($n)))}</data></zip>",
        function(error, result) {
            if(error) {
                console.error(error);
            } else {
                console.log("Finding Data");
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

router.post('/checkExists', function(req, res) {
    client.execute("XQUERY fn:doc-available('Colenso/" + req.query.filepath + "')",
        function(error, result) {
            if(error) {
                console.error("error:" + error);
                res.send("false");
            } else{
                console.log(req.query.filepath + " exists? " + result.result);
                res.send(result.result);
            }
        });
});

router.post('/validate', function(req, res) {
    res.send("true");
    /*console.log("-- Validation --");
    // req.query.filepath
    var validateString ="XQUERY " +
        " let $doc := '" + req.query.text + "'"+
        " let $schema := fetch:text('http://www.tei-c.org/release/xml/tei/custom/schema/xsd/tei_lite_xml.xsd')" +
        " return validate:xsd($doc, $schema)";

    client.execute("XQUERY" +
        " let $doc := '" + req.query.text + "' "+
        " let $schema := fetch:text('http://www.tei-c.org/release/xml/tei/custom/schema/xsd/tei_lite_xml.xsd') " +
        " return validate:xsd($doc, $schema)",
        function(error, result) {
            if(error) {
                console.error("error:" + error);
                res.send("false");
            } else{
                console.log("validation: " + result.result);
                res.send("true");
            }
        });*/
});

module.exports = router;
