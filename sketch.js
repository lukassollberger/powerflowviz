console.log("D3.js Version:", d3.version); 

// ---------------- Variables --------------------
// initial canvas size

const DESIGN_W = 1920;
const DESIGN_H = 1080;

let canvasWidth = DESIGN_W;
let canvasHeight = DESIGN_H;
// Map
let mapX = 50;
let mapY = 100;
// let aspect_ratio = 1  
// let mapWidth = 700;
// let mapHeight = 700;
// let gridWidth = 700;
// let gridHeight = 800;
let mapWidth = canvasWidth*0.45;
let mapHeight = mapWidth;
let gridWidth = mapWidth;
let gridHeight = gridWidth*1.1;
// let canvasWidth = mapWidth+1120;  // 1920 Total
// let canvasHeight = mapHeight+250; // 1050 Total
// let BKWmapImgscale = 1
let scaleFactor = 1;

// Legend
let legendX = canvasWidth/2 - 300;
let legendY = 130;

// grid visualization
let arrows = [];
let particles = [];

// base parameters
let lines = [];
let P_table = [];
let substations = [];

// circular plot parameters
let colName = "LTH 1BACBRI"; // Will be set by mouse click
let lineSelect = null; // Will be set by mouse click
// let chosen_line_limit = 0; // Will be set by mouse click
// Provide a safe default for `lineSelect` so code can reference its properties
lineSelect = {
  type: "132kV",
  from: { type: "132kV", name: "", x: 0, y: 0, power: 0 },
  to: { type: "132kV", name: "", x: 10, y: 0, power: 0 },
  power: 0,
  lineName: "Default Line",
  lineAbbrev: "LTH 1BACBRI",
  waypoints: [],
  linelimit: 75
};
let animatedBarLens = [];
let targetBarLens = [];
let lastColName = colName;
let minX, maxX, minY, maxY;
let average_power = null;

// circular plot center
let cx = canvasWidth * 0.7;
let cy = canvasHeight * 0.55;

// let FIRSTRUN = true;

// Global arrays for min, max, average per row (for later plotting)
let minPerRow = [];
let maxPerRow = [];
let averagePerRow = [];
let globalminVal = Infinity;
let globalmaxVal = -Infinity;
let nTimestamps;  // Declare nTimestamps globally
let pTableMin = Infinity;
let pTableMax = -Infinity;

// BKW Corporate Colors (RGB)
let BKW_Light_Yellow = [255, 204, 0];      // HEX #ffcc00
let BKW_Light_Green = [214, 215, 0];       // HEX #d6d700
let BKW_Light_Blue = [133, 207, 232];      // HEX #85cfe8
let BKW_Red = [221, 50, 33];               // HEX #dd3221
let BKW_Dark_Red = [106, 0, 56];           // HEX #6a0038
let BKW_Green = [0, 135, 45];              // HEX #00872d
let BKW_Dark_Green = [0, 72, 64];          // HEX #004840
let BKW_Blue = [0, 127, 167];              // HEX #007fa7
let BKW_Dark_Blue = [0, 45, 105];          // HEX #002d69
let BKW_Orange = [255, 100, 24];           // HEX #ff6418
let BKW_White = [255, 255, 255];           // HEX #ffffff
let BKW_Black_10 = [229, 229, 229];        // HEX #e5e5e5
let BKW_Black_25 = [191, 191, 191];        // HEX #bfbfbf
let BKW_Black_50 = [118, 118, 118];        // HEX #767676
let BKW_Black_75 = [64, 64, 64];           // HEX #404040
let BKW_Black = [0, 0, 0];                 // HEX #000000

// Line colors
let color380220kV = BKW_Green;
let color132kV = BKW_Orange;
let color50kV = BKW_Blue;

let magnifier = false;

// Background colors
let colorBackground = BKW_Black_10;

let BKWmapImg;

// voltage layers
let voltageLayers = {
    "380/220kV": { visible: true, lines: [], substations: [], particles: [], FIRSTRUN: false},
    "132kV":     { visible: true, lines: [], substations: [], particles: [], FIRSTRUN: false},
    "50kV":      { visible: true, lines: [], substations: [], particles: [], FIRSTRUN: false},
    "connector": { visible: true, lines: [], substations: [], particles: [], FIRSTRUN: false}
  };
  
let maxPower = 0; 

// slider
let timestamp = "2024-12-01 00:15"; 
let timestampInput;
let timelineRect = { x: 10, y: 30, w: canvasWidth/2 - 100, h: 40 };
let timelineActive = false;
  
// ---------------- Helper Functions --------------------
// Load power timeseries data
function load_power_data() {
  P_table = loadTable("Power_Vis_Data_Random.csv", "csv", "header");     // loadTable is based in Java and a little bit messy. Better use d3.dsv if time.
}

// Load substations data
function load_substations() {
    d3.dsv(";", "substations_list.csv", d3.autoType)
        .then(function (csv) {
            // Get min/max for scaling
            minX = d3.min(csv, d => d.X);
            maxX = d3.max(csv, d => d.X);
            minY = d3.min(csv, d => d.Y);
            maxY = d3.max(csv, d => d.Y);
            maxPower = d3.max(csv, d => d.P_MW || 0); 

            // Normalize and scale substations
            csv.forEach(d => {
                let scaledX = map(d.X, minX, maxX, mapX, mapX+gridWidth);
                let scaledY = map(d.Y, minY, maxY, mapY, mapY+gridHeight);
                const sub = { type: d.Type, name: d.Name, x: scaledX, y: scaledY, power: d.P_MW || 0 };
                substations.push(sub);
                if (voltageLayers[d.Type]) {
                  voltageLayers[d.Type].substations.push(sub);
                }
            });
            console.log("✅ Loaded substations:", substations);
        })
        .catch(function (error) {
            console.error("❌ Error loading substations CSV:", error);
        });
}

// Load lines data
function load_lines(timestamp) {
    d3.dsv(";", "line_list_out.csv").then(
      function (linedata) {
        let sum = 0;
        let count = 0;
        linedata.forEach(row => {
          let type = row.Type;
          let fromName = row.From;
          let toName = row.To;
          let fromStation = substations.find(s => s.name === fromName);
          let toStation = substations.find(s => s.name === toName);
          const lineName = row.Line_Name;
          const lineAbbrev = row.Line_Abbreviation;
          let linelimit = row.GW
          let power = getPowerFromTimeseries(timestamp, lineAbbrev);
          if (!isNaN(power)) {
            sum += power;
            count++;
          }

          let waypoints = [];
          if (row.Waypoints) {
            let raw = row.Waypoints.includes("|") ? row.Waypoints.split("|") : [row.Waypoints];
            waypoints = raw.map(pair => {
              let [origX, origY] = pair.split(",").map(Number);
              let x = map(origX, minX, maxX, mapX, gridWidth);
              let y = map(origY, minY, maxY, mapY, gridHeight);
              return { x, y };
            });
          }
          // 🔁 Swap direction when power is negative (swap stations, not just names and waypoints)
          if (power < 0) {
            [fromStation, toStation] = [toStation, fromStation];
            waypoints = waypoints.reverse();
            power = Math.abs(power); // to positive
          }

          if (fromStation && toStation) {
            if (voltageLayers[type]) {
              voltageLayers[type].lines.push({
                type,
                from: fromStation,
                to: toStation,
                power,
                lineName,
                lineAbbrev,
                waypoints,
                linelimit
              });
            }
          }
        });

        average_power = sum / count;
        // console.log(`Average power for timestamp ${timestamp}:`, average_power);
        // console.log(`COUNT ${timestamp}:`, count);
        // console.log(`SUM ${timestamp}:`, sum);

        // console.log("✅ Lines parsed and assigned to layers.");
      })
      .catch(function (error) {
        console.error("❌ Error loading lines CSV:", error);
      });
}

// Get power value from P_table for a given timestamp and line abbreviation
function getPowerFromTimeseries(timestamp, lineAbbrev) {

  // Find the column index for the line abbreviation
  let colIndex = P_table.columns.indexOf(lineAbbrev);
  if (colIndex === -1) {
    // console.warn('Line abbreviation not found:', lineAbbrev);
    return null;
  }
  // Find the row index for the timestamp
  for (let r = 0; r < P_table.getRowCount(); r++) {
    let ts = P_table.getString(r, 0); // get timestamp from first column
    if (ts === timestamp) {
      return P_table.getNum(r, colIndex);
    }
  }
  // console.warn('Timestamp not found:', timestamp);
  return null;
}

// Generate Particles  along lines
function generate_particles(voltage, layer) {

  // Only initialize particles on first run if we actually have lines loaded
  if (voltageLayers[voltage].FIRSTRUN) {
    if (!layer.lines || layer.lines.length === 0) {
      // Lines not yet loaded for this layer; skip initialization this frame
      // Keep FIRSTRUN true so we try again next frame
  
    } else {
      // voltageLayers[voltage].particles = [];
      // // Spread particles along the line at first run
      // layer.lines.forEach(l => {
      //   const path = [l.from, ...(l.waypoints || []), l.to];
      //   let pathLength = path.length;
      //   for (let seg = 0; seg < pathLength - 1; seg++) {
      //     for (let t = 0; t < 1; t += 0.5) {
      //       let px = lerp(path[seg].x, path[seg + 1].x, t);
      //       let py = lerp(path[seg].y, path[seg + 1].y, t);
      //       layer.particles.push({
      //         x: px,
      //         y: py,
      //         speed: 1,
      //         path: path,
      //         currentSegment: seg,
      //         alpha: map(l.power, 0, maxPerRow[5], 50, 255),
      //       });
      //     }
      //   }
      // });
      // // Only clear FIRSTRUN for this layer after particles were created
      voltageLayers[voltage].FIRSTRUN = false;
    }
        
  // Generate particles based on line power. Spawn normally at line start. 
  } else {

    // FIX: PARTICELDENSITIY DEPENDING ON POWER NEEDS TO BE ADJUSTET VIA FRAMECOOUNT
    // LIKE frameCount % L.POWER === 0
    // 
      if (frameCount % 20 === 0) {
          layer.lines.forEach(l => {
            for (let i = 0; i < l.power / 20; i++) {  // <-- THIS IS FALSE. FIX. THIS SPAWNS MULTIPLE PARTICELES DEPENDING ON POWER OVER EACHOTHER, IF ALL HAVE SAME SPEED THE TOTALLY OVERLAP. 
              const path = [l.from, ...(l.waypoints || []), l.to];
              layer.particles.push({
                x: path[0].x,
                y: path[0].y,
                // speed: random(0.1, 0.4),
                speed: 1,
                path: path,
                currentSegment: 0,
                alpha: map(l.power, 0, maxPerRow[5], 50, 255),   //  <-- FIND EXACT MAX POWER VALUE FROM RIGHT ROW
              });
              }
          });
          
      }
    }

    // Update and draw particles
  for (let i = layer.particles.length - 1; i >= 0; i--) {
        let p = layer.particles[i];

        // Get current segment
        let end   = p.path[p.currentSegment + 1];
        
        if (!end) {
          // Reached end of path
          layer.particles.splice(i, 1);
          continue;
        }
        
        let angle = atan2(end.y - p.y, end.x - p.x);
        p.x += cos(angle) * p.speed;
        p.y += sin(angle) * p.speed;

        // If close to end of segment, move to next segment
        if (dist(p.x, p.y, end.x, end.y) < 1) {
          p.currentSegment++;
        }

        // drawingContext.shadowBlur = 15;
        // drawingContext.shadowColor = color(0, 255, 0, 255);

        // draw particle
        fill(255, 255, 0, 60);
        noStroke();
        circle(p.x, p.y, 5);


        // draw Lines
        // let pxend = p.x + cos(angle) * 3; 
        // let pyend = p.y + sin(angle) * 3;
        // stroke(255, 255, 0, p.alpha);
        // strokeWeight(2);

        // line(p.x, p.y, pxend, pyend); 
    }

}
// Timeline rectangle for timestamp selection 
function timeline_slider() {
    noFill();
    noStroke();
    rect(timelineRect.x, timelineRect.y, timelineRect.w, timelineRect.h,2);

    // Draw ticks and marker
    let tsIdx = 0;
    for (let r = 0; r < nTimestamps; r++) {
      if (P_table.getString(r, 0) === timestamp) {
        tsIdx = r;
        break;
      }
    }
    // Marker for current timestamp
    let markerX = map(tsIdx, 0, nTimestamps - 1, timelineRect.x, timelineRect.x + timelineRect.w);
    stroke(BKW_Light_Green);
    strokeWeight(5);
    line(markerX, timelineRect.y-4, markerX, timelineRect.y + timelineRect.h+4);
    noStroke();
    fill(BKW_Light_Green);
    textAlign(CENTER, TOP);
    textSize(14);
    text(timestamp, markerX, timelineRect.y + timelineRect.h + 8);

    // draw ticks every 24 steps (1 per day for 15-min data)
    stroke(BKW_Light_Green);
    strokeWeight(2);
    for (let i = 0; i < nTimestamps; i += 96) {
      let tickX = map(i, 0, nTimestamps - 1, timelineRect.x, timelineRect.x + timelineRect.w);
      line(tickX, timelineRect.y, tickX, timelineRect.y + timelineRect.h);
    }
    noStroke();

    // Draw min, average, and max lines into time slider
    noFill();
    strokeWeight(2);
    // Average line (orange)
    stroke(BKW_Black);
    beginShape();
    for (let r = 0; r < nTimestamps; r++) {
      let x = map(r, 0, nTimestamps - 1, timelineRect.x, timelineRect.x + timelineRect.w);
      let y = map(averagePerRow[r], globalminVal, globalmaxVal, timelineRect.y + timelineRect.h, timelineRect.y);
      vertex(x, y);
    }
    endShape();
    // Min line (blue)
    stroke(BKW_Black);
    beginShape();
    for (let r = 0; r < nTimestamps; r++) {
      let x = map(r, 0, nTimestamps - 1, timelineRect.x, timelineRect.x + timelineRect.w);
      let y = map(minPerRow[r], globalminVal, globalmaxVal, timelineRect.y + timelineRect.h, timelineRect.y);
      vertex(x, y);
    }
    endShape();
    // Max line (red)
    stroke(BKW_Black);
    beginShape();
    for (let r = 0; r < nTimestamps; r++) {
      let x = map(r, 0, nTimestamps - 1, timelineRect.x, timelineRect.x + timelineRect.w);
      let y = map(maxPerRow[r], globalminVal, globalmaxVal, timelineRect.y + timelineRect.h, timelineRect.y);
      vertex(x, y);
    }
    endShape();

    return markerX;
}

function circularBarPlot(markerX) {
  let days = 7;
  let timevalues = 96;
  let n = days * timevalues;
  // let margin = 50;
  let minpower = -0;  // define min and max power for mapping
  let maxpower = 0;
  let PixelperMW = 0; 
  let MWSteps = 0; // How many MW per circle
  let radius_circularPlot = 250;

  // Find min/max for scaling
  let lineminVal = Infinity, linemaxVal = -Infinity;
  for (let r = 0; r < n; r++) {
    let val = P_table.getNum(r, colName);
    if (val < lineminVal) lineminVal = val;
    if (val > linemaxVal) linemaxVal = val;
  }

  if (lineSelect.type === "380/220kV") {
    minpower = -200;  // define min and max power for mapping
    maxpower = 200;
    PixelperMW = 0.5;   // How many MW are one pixel in bar length. Use to scale the circular plot appropriately.
    MWSteps = (maxpower*0.1)*PixelperMW;  // Each Circle represents 10% of max power per circle

  } else if (lineSelect.type === "132kV") {
    minpower = -100;  // define min and max power for mapping
    maxpower = 100;
    PixelperMW = 1;   
    MWSteps = (maxpower*0.1)*PixelperMW; 
  } else if (lineSelect.type === "50kV") {
    minpower = -20;  
    maxpower = 20;
    PixelperMW = 5;   
    MWSteps = (maxpower*0.1)*PixelperMW; 

  } else {
    minpower = -200;  
    maxpower = 200;
    PixelperMW = 0.5;
    MWSteps = (maxpower*0.1)*PixelperMW; 

  }
  let radius = radius_circularPlot;
  let barWidth = 2;
  let nBars = n; // one bar per time step
  let angleStep = TWO_PI / nBars;

  // If colName changed, update targetBarLens
  if (colName !== lastColName || targetBarLens.length !== nBars) {
    targetBarLens = [];
    for (let i = 0; i < nBars; i++) {
      let val = P_table.getNum(i, colName);
      let barLen = map(val, minpower, maxpower, minpower*PixelperMW, maxpower*PixelperMW);
      targetBarLens.push(barLen);
    }
    // If first time, set animatedBarLens instantly
    if (animatedBarLens.length !== nBars) {
      animatedBarLens = targetBarLens.slice();
    }
    lastColName = colName;
  }
  // Animate bar lengths
  for (let i = 0; i < nBars; i++) {
    animatedBarLens[i] = lerp(animatedBarLens[i], targetBarLens[i], 0.15); // smooth step
    let val = P_table.getNum(i, colName);
    let tmp = map(val, lineminVal, linemaxVal, 0, 1);
    let col = lerpColor(color(0, 100, 255), color(255, 0, 0), tmp);
    let angle = -HALF_PI + i * angleStep;
    let x0 = cx + cos(angle) * radius;
    let y0 = cy + sin(angle) * radius;
    let x1 = cx + cos(angle) * (radius + animatedBarLens[i]);
    let y1 = cy + sin(angle) * (radius + animatedBarLens[i]);
    stroke(col);
    strokeWeight(barWidth);
    line(x0, y0, x1, y1);
  }
  // Draw circle outline
  for (let r = -12; r <= 12; r++) {
    let rr = radius + (MWSteps * r);
    stroke(150);
    strokeWeight(1);
    ellipse(cx, cy, rr * 2, rr * 2);
    textAlign(CENTER, CENTER);
    
  // label only every second circle
    if (r % 2 === 0) {
      stroke(60);
      textAlign(CENTER, CENTER);
      textSize(10);
      text((MWSteps * r / PixelperMW) + " MW", cx, cy + rr);
    }  
  }
  noFill();
  stroke(0);
  strokeWeight(2);
  ellipse(cx, cy, radius * 2, radius * 2);


  // Draw limit circle
  outer_limit_radius = map(lineSelect.linelimit, 0, maxpower, radius, radius+maxpower*PixelperMW);
  inner_limit_radius = map(lineSelect.linelimit, 0, maxpower, radius, radius-maxpower*PixelperMW);
  stroke("red");
  strokeWeight(2);
  ellipse(cx, cy, outer_limit_radius*2, outer_limit_radius*2);
  ellipse(cx, cy, inner_limit_radius*2, inner_limit_radius*2);

  // Add weekday names and ticks inside the circle 
  let weekdayNames = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  let daysInWeek = 7;
  let labelRadius = radius + 150;
  let tickRadiusInner = radius - 150;
  let tickRadiusOuter = radius + 150;
  textAlign(CENTER, CENTER);
  textSize(18);
  fill(0);
  strokeWeight(2);
  for (let d = 0; d < daysInWeek; d++) {
    let angle = -HALF_PI + d * (TWO_PI / daysInWeek);
    
    // Weekday label
    let lx = cx + cos(angle+PI/7) * labelRadius;
    let ly = cy + sin(angle+PI/7) * labelRadius;
    noStroke();
    text(weekdayNames[d], lx, ly);
    
    // Tick
    stroke(150);
    let tx0 = cx + cos(angle) * tickRadiusInner;
    let ty0 = cy + sin(angle) * tickRadiusInner;
    let tx1 = cx + cos(angle) * tickRadiusOuter;
    let ty1 = cy + sin(angle) * tickRadiusOuter;
    line(tx0, ty0, tx1, ty1);
  }

  // draw marker line
  stroke(BKW_Light_Green);
  strokeWeight(5);
  translate(cx, cy);   // translate to center first, then rotate so rotation is around (cx, cy)
  let markerAngle = map(markerX, timelineRect.x, timelineRect.x + timelineRect.w, -HALF_PI, -HALF_PI + TWO_PI );
  rotate(markerAngle);
  line(0, 0, radius, 0);

  pop();
}

function resizeToWindow() {
  scaleFactor = min(windowWidth / DESIGN_W, windowHeight / DESIGN_H);
  resizeCanvas(DESIGN_W * scaleFactor, DESIGN_H * scaleFactor);
}

function windowResized() {
  // resizeToWindow();
  resizeToWindow();
}


// ---------------- Preload function --------------------
// p5.js: Load timeseries in preload, rest in setup. Otherwise timeseries data is not fully loaded when needed, due to the way p5.js handles the default preload function.
function preload() {
  BKWmapImg = loadImage("bkw_map.png");  
  load_power_data();  // load power timeseries data in preload
  load_substations();     // load substation data in preload
}

// ---------------- Setup function --------------------
function setup() {
    // P_table = d3.dsv(",", "Power_Vis_Data_P.csv")  // optional if time: check if you can load csv with d3 here instead of p5 loadTable
    // console.log(P_table.getColumnCount() + ' total columns in table');  // check if table is loaded correctly

    // Load substation and line data
    load_lines(timestamp);  // load line data in setup after power timeseries is fully loaded in preload()
    

    // Set up canvas
    noStroke();

    // createCanvas(canvasWidth, canvasHeight, SVG); // for SVG export
    // canvasHeight = windowHeight;
    // canvasWidth = windowWidth;
    // createCanvas(canvasWidth, canvasHeight);
    createCanvas(10, 10);

    resizeToWindow();
    // Simple: min, max, average per row
    minPerRow = [];
    maxPerRow = [];
    averagePerRow = [];
    for (let r = 0; r < P_table.getRowCount(); r++) {
      let vals = [];
      for (let c = 1; c < P_table.getColumnCount(); c++) {
        let v = P_table.getNum(r, c);
        if (!isNaN(v)) vals.push(v);
      }
      if (vals.length > 0) {
        minPerRow[r] = Math.min(...vals);
        maxPerRow[r] = Math.max(...vals);
        averagePerRow[r] = vals.reduce((a, b) => a + b, 0) / vals.length;

        if (minPerRow[r] < globalminVal) globalminVal = minPerRow[r];
        if (maxPerRow[r] > globalmaxVal) globalmaxVal = maxPerRow[r];


      } else {
        minPerRow[r] = maxPerRow[r] = averagePerRow[r] = NaN;
      }
    }
    nTimestamps = P_table.getRowCount();

    // compute global min/max from P_table
    for (let r = 0; r < P_table.getRowCount(); r++) {
      for (let c = 1; c < P_table.getColumnCount(); c++) {
        let v = P_table.getNum(r, c);
        if (!isNaN(v)) {
          if (v < pTableMin) pTableMin = v;
          if (v > pTableMax) pTableMax = v;
        }
      }
    }
    console.log('P_table global min/max:', pTableMin, pTableMax);

    // console.log('minPerRow:', minPerRow);
    // console.log('maxPerRow:', maxPerRow);
    // console.log('averagePerRow:', averagePerRow);

}


// ---------------- Draw function --------------------
function draw() {

    background(colorBackground);
    push();
    scale(scaleFactor);
    // tint(255, 255, 255, 255);  
    image(BKWmapImg, mapX-50, mapY, mapWidth, mapHeight);  
    // noTint();  
    // pop();
    if (substations.length === 0) {
        text("Loading data...", width / 2, height / 2);
        return;
    }
 
    for (let voltage in voltageLayers) {
        const layer = voltageLayers[voltage];
        if (!layer.visible) continue;
      
        // Draw lines
        strokeWeight(2);
        layer.lines.forEach(l => {
              // 🟢 Set stroke color based on voltage type
              if (l.power === null || isNaN(l.power)) {
                stroke(150); // Gray for missing data
              } else if (l.type === "380/220kV") {
                stroke(color380220kV);       // Green
              } else if (l.type === "132kV") {
                stroke(color132kV);     // Orange
              } else if (l.type === "50kV") {
                stroke(color50kV);     // Blue
              } else {
                stroke(100);             // Fallback gray
              }

              noFill();
              beginShape();
              vertex(l.from.x, l.from.y);
              l.waypoints?.forEach(wp => vertex(wp.x, wp.y));
              vertex(l.to.x, l.to.y);
              endShape();
         });
      
        // Particle system 
        generate_particles(voltage, layer);

          
        // Draw substations
        noStroke();
        layer.substations.forEach(sub => {
          let subColor = color(150);
          let size = 4;
          if (sub.type === "380/220kV") {
            subColor = color(color380220kV);
            size = 12;
          } else if (sub.type === "132kV") {
            subColor = color(color132kV);
            size = 8;
          } else if (sub.type === "50kV") {
            subColor = color(color50kV);
            size = 6;
          }
          // fill(subColor);
          // ellipse(sub.x, sub.y, size, size);

          // // Glow effect based on power
          // drawingContext.shadowBlur = 15;
          // let alpha = map(sub.power, 0, maxPower, 0, 255); // map(value, inMin, inMax, outMin, outMax)
          // drawingContext.shadowColor = color(255, 0, 0, alpha);

          fill(subColor);
          ellipse(sub.x, sub.y, size, size);

          // Show name only if mouse is hovering over substation
          let d = dist(mouseX/scaleFactor, mouseY/scaleFactor, sub.x, sub.y);
          if (d < 5) { // Show name if mouse is within 10 pixels
            textAlign(CENTER, CENTER);
            textSize(20);
            fill(255);
            text(sub.name, sub.x, sub.y);
          }
        });
      }
  

    drawLegend();
    drawTitle();



    // ---------------- Plot timerseries --------------------
    

    // // Draw line plot
    // noFill();
    // strokeWeight(4);
    // beginShape();
    // let row = 0;
    // for (let d = 1; d < days+1; d++) {
    //     for (let t = 0; t < timevalues; t++) {
    //       let x1 = map(t, 0, timevalues - 1, gridWidth+100, canvasWidth - margin);
    //       let y1 = d*50
    //       let x2 = map(t, 0, timevalues - 1, gridWidth+100, canvasWidth - margin);
    //       let y2 = d*50 + 50;
    //       let val = P_table.getNum(row, colName);
    //       row = row+1
    //       // Map val to a color gradient (e.g., blue to red)
    //       let tmp = map(val, lineminVal, linemaxVal, 0, 1);
    //       let col = lerpColor(color(0, 100, 255), color(255, 0, 0), tmp);
    //       stroke(col);

    //       line(x1, y1, x2, y2);
    //     }
    // }
    // endShape()

    // Timeline rectangle for timestamp selection
    let markerX = timeline_slider()

    //  Circular bar plot
    circularBarPlot(markerX);

    
    // Draw Mouse Pos onto screen
    if (substations.length > 0) {
      // Convert canvas to original coordinates
      let origX = map(mouseX/scaleFactor, 50, gridWidth, minX, maxX);
      let origY = map(mouseY/scaleFactor, 50, gridHeight, minY, maxY);
    
      // Optional: round for readability
      origX = nf(origX, 1, 0);  // or use toFixed()
      origY = nf(origY, 1, 0);
    
      // Draw background label
      fill(255, 255, 255, 200);
      rect(mouseX/scaleFactor+20, mouseY/scaleFactor, 50, 30, 5);
    
      // Draw text
      fill(0);
      textSize(10);
      text(`X: ${origX}`, mouseX/scaleFactor + 40, mouseY/scaleFactor + 20);
      text(`Y: ${origY}`, mouseX/scaleFactor + 40, mouseY/scaleFactor + 10);
    }
    
    // textSize(10);
    // fill(0);
    // textAlign(LEFT, TOP);
    // text("📅 Letztes Update: " + lastUpdateTime, 20, canvasHeight - 30);

    fill(255);
    textAlign(LEFT, BOTTOM);
    textSize(10);
    text(timestamp, 20, canvasHeight - 10);

    textSize(10);
    fill(255);
    textAlign(RIGHT, BOTTOM);
    text(`Average Power: ${average_power !== null ? average_power.toFixed(2) : "N/A"}`, canvasWidth - 20, canvasHeight - 10);

    if (magnifier) {
      drawMagnifier(mouseX/scaleFactor, mouseY/scaleFactor, 100, 2);
    }
    pop();

}

function keyPressed() {
    if (key === '1') voltageLayers["380/220kV"].visible = !voltageLayers["380/220kV"].visible;
    if (key === '2') voltageLayers["132kV"].visible     = !voltageLayers["132kV"].visible;
    if (key === '3') voltageLayers["50kV"].visible       = !voltageLayers["50kV"].visible;
  
    console.log("🔁 Voltage layer visibility:", {
      "380/220kV": voltageLayers["380/220kV"].visible,
      "132kV": voltageLayers["132kV"].visible,
      "50kV": voltageLayers["50kV"].visible
    });
  }
  
  function drawLegend() {
    const items = [
      { key: "Numpad 1", label: "380/220kV", color: color(color380220kV), visible: voltageLayers["380/220kV"].visible },
      { key: "Numpad 2", label: "132kV",     color: color(color132kV), visible: voltageLayers["132kV"].visible },
      { key: "Numpad 3", label: "50kV",      color: color(color50kV), visible: voltageLayers["50kV"].visible }
    ];
  
    textAlign(LEFT, CENTER);
    textSize(18);
    text("Spannungsebenen Ein- und Ausblender:",legendX,legendY-20);
    items.forEach((item, index) => {
      fill(item.visible ? item.color : 150);
      rect(legendX, legendY + index * 25, 15, 15, 3);
  
      fill(0);
      text(`[${item.key}] ${item.label}`, legendX + 25, legendY + index * 25 + 7);
    });

    text("Mit Taste M Lupe aktivieren/deaktivieren:",legendX,legendY + items.length * 25 + 20);

  }

function drawTitle() {

  textAlign(RIGHT, TOP);
  fill(0);

  // Titel
  textSize(50);
  textStyle(BOLD);
  text("Eine Woche im Hochspannungsnetz",canvasWidth - 10,10);

  // Lead / Untertitel
  textSize(18);
  textStyle(NORMAL);
  // text("Diese Visualisierung macht die Energieflüsse im Hochspannungsnetz\nim Raum Bern, Jura und Solothurn",canvasWidth - 10,70);
 text(
    "Das Hochspannungsnetz der BKW Energie AG besteht" +
    "aus mehreren Tausend Kilometer Leitung, verteilt auf\n" +
    "zwei Spannungsebenen - 50 kV und 132 kV (Kilovolt)." +
    "Hinzu kommt das überlagerte Höchstspannungsnetz der\n" +
    "Swissgrid. Diese vielen Hochspannungsleitungen formen" +
    "ein komplexes vermaschtes Netz und stellen den über-\n" +
    "regionalen Transport der elektrischen Energie sicher." +
    "Zusammen bilden sie das Rückgrat einer stabilen \n" +
    "Energieversorgung. Dieses Visualisierung macht die Energieflüsse in diesem komplexen Netz sichtbar.",
    canvasWidth - 10,
    70
  );
}


function mousePressed() {

  // Check line clicks  
  let minDist = 10; // px threshold for click
  let found = false;
  // console.log("Mouse pressed at:", mouseX, mouseY);
  for (let voltage in voltageLayers) {
    const layer = voltageLayers[voltage];
    layer.lines.forEach(l => {
      // Check direct line (from-to)
      let pts = [l.from, ...(l.waypoints || []), l.to];
      for (let i = 0; i < pts.length - 1; i++) {
        let x0 = pts[i].x;
        let y0 = pts[i].y;
        let x1 = pts[i+1].x;
        let y1 = pts[i+1].y;
        // Closest point on segment
        let dx = x1 - x0;
        let dy = y1 - y0;
        let t = ((mouseX/scaleFactor - x0) * dx + (mouseY/scaleFactor - y0) * dy) / (dx*dx + dy*dy);
        t = constrain(t, 0, 1);
        let px = x0 + t * dx;
        let py = y0 + t * dy;
        let d = dist(mouseX/scaleFactor, mouseY/scaleFactor, px, py);
        if (d < minDist) {
          // Ensure lineAbbrev is a non-empty string
          if (typeof l.lineAbbrev !== 'string' || l.lineAbbrev.trim() === '') {
            console.warn('Line abbreviation missing or invalid for line:', l);
            colName = 'LTH 1BACBRI';
            lineSelect = l; 
            //chosen_line_limit = l.linelimit;
            found = true;
          } else {
            colName = l.lineAbbrev;
            lineSelect = l; 
            //chosen_line_limit = l.linelimit;
            found = true;
          }
        }
      }
    });
  }
  if (found) {
    print('Selected line:', colName);
  }
}

  
// Detect line click and update colName for timeseries plot
function mouseDragged() {
  // Timeline interaction
  if (
    mouseY/scaleFactor > timelineRect.y && mouseY/scaleFactor < timelineRect.y + timelineRect.h &&
    mouseX/scaleFactor > timelineRect.x && mouseX/scaleFactor < timelineRect.x + timelineRect.w
  ) {
    let nTimestamps = P_table.getRowCount();
    let idx = Math.round(map(mouseX/scaleFactor, timelineRect.x, timelineRect.x + timelineRect.w, 0, nTimestamps - 1));
    idx = constrain(idx, 0, nTimestamps - 1);
    let newTimestamp = P_table.getString(idx, 0);
    if (newTimestamp !== timestamp) {
      timestamp = newTimestamp;
      // Clear lines and particles for all voltage layers
      for (let voltage in voltageLayers) {
        voltageLayers[voltage].lines = [];
        voltageLayers[voltage].particles = [];
        voltageLayers[voltage].FIRSTRUN = true;
      }
      setup();
    }
    timelineActive = true;
    return;
  }
  





  
  
}

function keyTyped() {
   if (key === 's') {
    saveCanvas("PowerViz.png");
    // save("PowerViz.svg");
  }
  if (key === 'm' && magnifier) {
    magnifier = false
    return  
  }
  if (key === 'm' && !magnifier) {
    magnifier = true
    return;
  }
}

function drawMagnifier(cxMouse, cyMouse, radius = 80, zoom = 2) {
  const ctx = drawingContext;              // underlying CanvasRenderingContext2D
  const canvasEl = ctx.canvas;
  const dpr = window.devicePixelRatio || 1;

  // clamp requested values so source rectangle stays inside canvas
  const sw = (radius * 2) / zoom;
  const sh = sw;
  let sx = (cxMouse - sw / 2);
  let sy = (cyMouse - sh / 2);

  // clamp source rectangle
  sx = Math.max(0, Math.min(sx, canvasEl.width / dpr - sw));
  sy = Math.max(0, Math.min(sy, canvasEl.height / dpr - sh));

  // save, clip to circle, draw scaled portion into the circle, restore
  ctx.save();
  ctx.beginPath();
  ctx.arc(cxMouse, cyMouse, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  // drawImage(source, sx, sy, sw, sh, dx, dy, dw, dh)
  ctx.drawImage(canvasEl, sx * dpr, sy * dpr, sw * dpr, sh * dpr,
                cxMouse - radius, cyMouse - radius, radius * 2, radius * 2);

  ctx.restore();

  // border + crosshair (optional)
  noFill();
  stroke(255);
  strokeWeight(4);
  ellipse(cxMouse, cyMouse, radius * 2, radius * 2);
}