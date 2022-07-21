const fs = require("node:fs");
const config = require("./config.json");

// Key Words:
// MDTF: Metadata Data Transfer Format
// AMPS: Automatic Meteorological Profiling System
// LRFE: Low Resolution Flight Element

var header;

function main(filename) {
  var file = fs.readFileSync(filename, "utf8");
  lines = file.split("\n");

  header = parseHeader(lines);
  console.log("Header: ", header);

  var lrfeData = parseData(lines, getDataTypeByName("LRFE"));
  console.log("LRFE Data: ", lrfeData);
  // pushToInflux(lrfeData, "LRFE");

  var mandatoryLevels = parseData(lines, getDataTypeByName("MandatoryLevels"));
  console.log("Mandatory Levels: ", mandatoryLevels);
  // pushToInflux(mandatoryLevels, "Mandatory Levels");

  var significantLevels = parseData(
    lines,
    getDataTypeByName("SignificantLevels")
  );
  console.log("Significant Levels: ", significantLevels);
  // pushToInflux(significantLevels, "Significant Levels");
}

function getDataTypeByName(name) {
  return config[name];
}

function parseHeader(lines) {
  var preamble = ["Start data file number"];
  var startLine = findLineLocation(lines, preamble) + 1;
  console.log("Start Line: ", startLine);
  if (startLine < 0) {
    console.log("Error: Could not find preamble: " + preamble);
    return null;
  }
  var header = {};

  // Identifier header
  var identifier = lines[startLine];
  var identifierArray = identifier.split(" ");
  header.identifier = identifierArray[0];

  // Description
  header.description = lines[startLine + 1];

  // Test Number
  header.testnbr = lines[startLine + 2];

  // Measuring equipment header
  header.measuring_equipment = lines[startLine + 3];

  // Measuring site location
  header.location = lines[startLine + 4];

  // Zulu time of balloon launch or initial measurement
  header.launch_time = lines[startLine + 5];

  return header;
}

/**
 * Parses the data from the rawinsonde file and returns an array of objects
 * @param {array} lines - array of lines from the rawinsonde file
 * @returns {array} - array of objects containing the data
 */
function parseData(lines, dataType) {
  var parsedData = [];
  var preamble = dataType.preamble;
  var startLine = findLineLocation(lines, preamble, "start");
  console.log("Start Line: ", startLine);
  if (startLine <= 0) {
    console.log("Error: Could not find preamble: " + preamble);
    return null;
  }

  var postamble = dataType.postamble;
  var endLine = findLineLocation(lines, postamble, "end", startLine);
  console.log("End Line: ", endLine);
  if (startLine <= 0) {
    console.log("Error: Could not find postamble: " + postamble);
    return null;
  }

  var dataLines = lines.slice(startLine, endLine);

  var dataArray = [];

  for (var i = 0; i < dataLines.length; i++) {
    var dataObject = {};

    // Merge the headers with the data
    for (var j = 0; j < dataType.headers.length; j++) {
      var header = dataType.headers[j].header;
      dataObject[header] = dataLines[i].trim().split(/\s+/)[j];
    }

    dataArray.push(dataObject);
  }

  return dataArray;
}

/**
 * Finds the first line in the array of strings that contains all of the elements in the preamble
 * @param {*} lines - array of strings
 * @param {*} preamble - array of strings
 * @returns {int} - index of the first line that contains all of the elements in the preamble
 */
function findLineLocation(
  lines,
  preamble,
  startOrEnd = "start",
  startIndex = 0
) {
  for (var i = startIndex; i < lines.length; i++) {
    var preambleFound = true;
    for (var j = 0; j < preamble.length; j++) {
      if (!lines[i + j].includes(preamble[j])) {
        preambleFound = false;
        break;
      }
    }
    if (preambleFound) {
      var lineIndex;
      if (startOrEnd === "start") {
        lineIndex = i + preamble.length;
      } else if (startOrEnd === "end") {
        lineIndex = i;
      }

      console.log("Found preamble: " + preamble + " at line: " + lineIndex);
      return lineIndex;
    }
  }
  console.log("Error: Could not find preamble: " + preamble);
  return -1;
}

function postToInflux(data, dataType) {
  return;
}

main("test.txt");
