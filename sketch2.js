let lines = [];
let table;
let plotHeight = 600;
let plotWidth = 600;
function preload() {
    // load the lines data from a JSON file

    table = loadTable("Power_Vis_Data_P.csv", "csv", "header", {delimiter: ";"});

}

            
            
// setup function for drawing
function setup() {
    createCanvas(plotWidth, plotHeight);
    noStroke();
    print(table.getRowCount() + ' total rows in table');
    print(table.getColumnCount() + ' total columns in table');
    console.log(table);


}

function draw() {

  background(255);

/* 
  let colName = "LTH 1BACBRI"; // Change to your desired column
  let n = table.getRowCount();
  let margin = 50;

  // Find min/max for scaling
  let minVal = Infinity, maxVal = -Infinity;
  for (let r = 0; r < n; r++) {
    let val = table.getNum(r, colName);
    if (val < minVal) minVal = val;
    if (val > maxVal) maxVal = val;
  }


  // Draw line plot
  noFill();
  stroke(0, 100, 255);
  strokeWeight(2);
  beginShape();
  for (let r = 0; r < n; r++) {
    let x = map(r, 0, n - 1, margin, plotWidth - margin);
    let y = map(table.getNum(r, colName), minVal, maxVal, plotHeight - margin, margin);
    vertex(x, y);
  }
  endShape(); */

}

