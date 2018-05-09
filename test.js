const path = require("path");
const url = require("url");
const fs = require("fs");
const request = require("request");
const progress = require("progress-stream");
const async = require("async");


var functionArray = new Array();
for (var i =0;i<5;i++) {
	let j =i;
functionArray.push(function(callback) {
			console.log(j);
			//callback(null, 'done');
		});
}

async.parallel(functionArray,
// optional callback
function(err, results) {
	console.log(results);
    // the results array will equal ['one','two'] even though
    // the second function had a shorter timeout.
});
/*
[
    function(callback) {
        setTimeout(function() {
            callback(null, 'one');
        }, 200);
    },
    function(callback) {
        setTimeout(function() {
            callback(null, 'two');
        }, 100);
    }
]
 */