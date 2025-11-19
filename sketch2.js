let lines = [];
let table;
let plotHeight = 600;
let plotWidth = 600;
function preload() {
    // load the lines data from a JSON file

    table = loadTable("Power_Vis_Data_P.csv", "csv", "header");

}

            
            
// setup function for drawing
function setup() {
    createCanvas(plotWidth, plotHeight);
    noStroke();
    // print(table.getRowCount() + ' total rows in table');
    // print(table.getColumnCount() + ' total columns in table');
    console.log(table);


}

function draw() {

  background(255);


  let colName = "LTH 1BACBRI"; // Change to your desired column
  let days = 7
  let timevalues = 96
  let n = days * timevalues;   

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
  strokeWeight(4);
  beginShape();
  for (let d = 1; d < days+1; d++) {
      for (let t = 0; t < timevalues; t++) {
        let x1 = map(t, 0, n - 1, margin, plotWidth - margin);
        let y1 = d*50
        let x2 = map(t, 0, n - 1, margin, plotWidth - margin);
        let y2 = d*50 + 50;
        let val = table.getNum(t*d, colName);
        // Map val to a color gradient (e.g., blue to red)
        let tmp = map(val, minVal, maxVal, 0, 1);
        let col = lerpColor(color(0, 100, 255), color(255, 0, 0), tmp);
        stroke(col);

        line(x1, y1, x2, y2);
      }
  }

  endShape();


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
  endShape();

}

