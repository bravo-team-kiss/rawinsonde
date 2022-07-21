const fs = require("node:fs");
const config = require("./config.json");

// Key Words:
// MDTF: Metadata Data Transfer Format
// AMPS: Automatic Meteorological Profiling System
// LRFE: Low Resolution Flight Element

function main() {
  var fileName = process.argv[2];
  var file = fs.readFileSync(fileName, "utf8");
  console.log("File: ", file);
  lines = file.split("\n");

  var header = parseHeader(lines);
  console.log("Header: ", header);

  var lrfeData = parseData(lines, getDataTypeByName("LRFE"));
  console.log("LRFE Data: ", lrfeData);
  pushLFREToInflux(header, lrfeData, getDataTypeByName("LRFE"));

  // var mandatoryLevels = parseData(lines, getDataTypeByName("MandatoryLevels"));
  // console.log("Mandatory Levels: ", mandatoryLevels);
  // // pushToInflux(mandatoryLevels, "Mandatory Levels");

  // var significantLevels = parseData(
  //   lines,
  //   getDataTypeByName("SignificantLevels")
  // );
  // console.log("Significant Levels: ", significantLevels);
  // // pushToInflux(significantLevels, "Significant Levels");
}

function getDataTypeByName(name) {
  return config[name];
}

function parseHeader(lines) {
  var preamble = ["Start data file number"];
  var startLine = findLineLocation(lines, preamble);
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
  header.launch_time = parseDate(lines[startLine + 5]);

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

function parseDate(dateString) {
  console.log("Date String: ", dateString);
  let dateArray = dateString.trim().split(/\s+/);
  let zulu_time = dateArray[0];
  let hours = zulu_time.slice(0, 2);
  let minutes = zulu_time.slice(2, 4);
  let day = dateArray[1];
  let monthIndex = getMonthIndex(dateArray[2]);
  let year = "20" + dateArray[3];
  var date = new Date(Date.UTC(year, monthIndex, day, hours, minutes));
  console.log("Date: ", date);
  return date;
}

function getMonthIndex(month) {
  var monthIndex = -1;
  switch (month) {
    case "JAN":
      monthIndex = 0;
      break;
    case "FEB":
      monthIndex = 1;
      break;
    case "MAR":
      monthIndex = 2;
      break;
    case "APR":
      monthIndex = 3;
      break;
    case "MAY":
      monthIndex = 4;
      break;
    case "JUN":
      monthIndex = 5;
      break;
    case "JUL":
      monthIndex = 6;
      break;
    case "AUG":
      monthIndex = 7;
      break;
    case "SEP":
      monthIndex = 8;
      break;
    case "OCT":
      monthIndex = 9;
      break;
    case "NOV":
      monthIndex = 10;
      break;
    case "DEC":
      monthIndex = 11;
      break;
    default:
      console.log("Error: Invalid month: " + month);
      break;
  }
  return monthIndex;
}

function pushLFREToInflux(header, data, dataType) {
  const { InfluxDB } = require("@influxdata/influxdb-client");

  // You can generate an API token from the "API Tokens Tab" in the UI
  const token = process.env.INFLUX_TOKEN;
  const org = "team-kiss";
  const bucket = "rawinsonde";

  const client = new InfluxDB({ url: "http://localhost:8086", token: token });

  const { Point } = require("@influxdata/influxdb-client");
  const writeApi = client.getWriteApi(org, bucket);
  writeApi.useDefaultTags({ host: "host1" });

  for (var i = 0; i < data.length; i++) {
    var dataObject = data[i];
    var point = new Point("rawinsonde");
    point.tag("data_type", dataType.name);
    point.tag("location", header.location);
    point.tag("altitude", dataObject.ALT);

    for (var j = 0; j < dataType.headers.length; j++) {
      var name = dataType.headers[j].header;
      var value = dataObject[name];
      point.floatField(name, value);
    }

    console.log("Point: ", point);

    writeApi.writePoint(point);
  }

  writeApi
    .close()
    .then(() => {
      console.log("FINISHED");
    })
    .catch((e) => {
      console.error(e);
      console.log("Finished ERROR");
    });

  return;
}

main();
