

let arrows = [];
let particles = [];
let colName = "LTH 1BACBRI"; // Will be set by mouse click
let animatedBarLens = [];
let targetBarLens = [];
let lastColName = colName;
let substations = [];
let lines = [];
let P_table = [];
console.log("D3.js Version:", d3.version); 
let minX, maxX, minY, maxY;
let aspect_ratio = 1  
let mapWidth = 800;
let mapHeight = 800;
let gridWidth = 800;
let gridHeight = 900;
let canvasWidth = mapWidth+1120;  // 1920 Total
let canvasHeight = mapHeight+250; // 1050 Total
let BKWmapImgscale = 1
let average_power = null;

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

// Background colors
let colorBackground = BKW_Dark_Blue;

let BKWmapImg;



let voltageLayers = {
    "380/220kV": { visible: true, lines: [], substations: [], particles: [] },
    "132kV":     { visible: true, lines: [], substations: [], particles: [] },
    "50kV":      { visible: true, lines: [], substations: [], particles: [] },
    "connector": { visible: true, lines: [], substations: [], particles: [] }
  };
  
let maxPower = 0; 

let timestamp = "01-01-2024 00:45"; 
let timestampInput;

function preload() {
  BKWmapImg = loadImage("bkw_map.png");  // transparentes Bild laden
  // p5.js: Load timeseries in preload, rest in setup. Otherwise timeseries data is not fully loaded when needed, due to the way p5.js handles the default preload function.
  P_table = loadTable("Power_Vis_Data_P.csv", "csv", "header");  
  // klintFont = loadFont("fonts/KlintforBKW-Regular.ttf");
  load_substations();     // load substation data in preload

}

function load_substations() {
    d3.dsv(";", "substations_list.csv", d3.autoType)
        .then(function (csv) {
            // Get min/max for scaling
            minX = d3.min(csv, d => d.X);
            maxX = d3.max(csv, d => d.X);
            minY = d3.min(csv, d => d.Y);
            maxY = d3.max(csv, d => d.Y);
            maxPower = d3.max(csv, d => d.P_MW || 0); 

            console.log("🔹 Original coordinate range: X(", minX, "to", maxX, "), Y(", minY, "to", maxY, ")");

            // Normalize and scale substations
            csv.forEach(d => {
                let scaledX = map(d.X, minX, maxX, 50, gridWidth);
                let scaledY = map(d.Y, minY, maxY, 50, gridHeight);
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

function load_lines(timestamp) {
    d3.dsv(";", "line_list_out.csv").then(
      function (linedata) {
        let sum = 0;
        let count = 0;
        linedata.forEach(row => {
          let type = row.Type;
          let fromName = row.From;
          let toName = row.To;

          const lineName = row.Line_Name;
          const lineAbbrev = row.Line_Abbreviation;
          const fromStation = substations.find(s => s.name === fromName);
          const toStation = substations.find(s => s.name === toName);

          let power = getPowerFromTimeseries(timestamp, lineAbbrev);
          if (!isNaN(power)) {
            sum += power;
            count++;
          }
          console.log(`(${lineAbbrev}), Power: ${power}`);
          // 🔁 Swap direction when power is negative
          if (power < 0) {
            [fromName, toName] = [toName, fromName];  // swap
            power = Math.abs(power); // to positive
          }

          let waypoints = [];
          if (row.Waypoints) {
            let raw = row.Waypoints.includes("|") ? row.Waypoints.split("|") : [row.Waypoints];
            waypoints = raw.map(pair => {
              let [origX, origY] = pair.split(",").map(Number);
              let x = map(origX, minX, maxX, 50, gridWidth);
              let y = map(origY, minY, maxY, 50, gridHeight);
              return { x, y };
            });
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
                waypoints
              });
            }
          }
        });

        average_power = sum / count;
        console.log(`Average power for timestamp ${timestamp}:`, average_power);
        console.log(`COUNT ${timestamp}:`, count);
        console.log(`SUM ${timestamp}:`, sum);

        console.log("✅ Lines parsed and assigned to layers.");
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
    console.warn('Line abbreviation not found:', lineAbbrev);
    return null;
  }
  // Find the row index for the timestamp
  for (let r = 0; r < P_table.getRowCount(); r++) {
    let ts = P_table.getString(r, 0); // get timestamp from first column
    if (ts === timestamp) {
      return P_table.getNum(r, colIndex);
    }
  }
  console.warn('Timestamp not found:', timestamp);
  return null;
}


// setup function 
function setup() {
    // P_table = d3.dsv(",", "Power_Vis_Data_P.csv")  // optinal if time: check if you can load csv with d3 here instead of p5 loadTable

    console.log(P_table.getColumnCount() + ' total columns in table');  // check if table is loaded correctly
    
    // Load substation and line data
    load_lines(timestamp);  // load line data in setup after power timeseries is fully loaded in preload()

    // Set up canvas
    noStroke();
    createCanvas(canvasWidth, canvasHeight);

    // Create timestamp input box (only once)
    if (!timestampInput) {
      timestampInput = createInput(timestamp);
      timestampInput.position(20, 20);
      timestampInput.size(180);
      timestampInput.input(onTimestampChange);
    }
// Callback for timestamp input
function onTimestampChange() {
  let newTimestamp = timestampInput.value();
  if (newTimestamp !== timestamp) {
    timestamp = newTimestamp;
    // Clear lines for all layers before reload
    for (let voltage in voltageLayers) {
      voltageLayers[voltage].lines = [];
    }
    setup(); // recall setup to reload data
  }
}
}


// draw function -- this function is called repeatedly to render the visualization
function draw() {
    background(colorBackground);
    push();
    // tint(255, 255, 255, 255);  
    image(BKWmapImg, 0, 50, mapWidth*BKWmapImgscale, mapHeight*BKWmapImgscale);  
    // noTint();  
    pop();
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
              if (l.type === "380/220kV") {
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
      
      

      // //  Generate arrows as a stream: higher power = smaller gaps
      // noStroke();
      // layer.lines.forEach(l => {
      //   let minInterval = 5;   // minimum frames between arrows (high power)
      //   let maxInterval = 60;  // maximum frames between arrows (low power)
      //   let interval = maxInterval - (maxInterval - minInterval) * (l.power / maxPower);
      //   interval = constrain(interval, minInterval, maxInterval);
      //   if (frameCount % Math.round(interval) === 0) {
      //     arrows.push({
      //       x: l.from.x,
      //       y: l.from.y,
      //       speed: .2 + (l.power / maxPower) * 1.5, // speed based on power
      //       angle: atan2(l.to.y - l.from.y, l.to.x - l.from.x),
      //       targetX: l.to.x,
      //       targetY: l.to.y
      //     });
      //   }
      // });
        
      //   // Update and draw arrows
      //     for (let i = arrows.length - 1; i >= 0; i--) {
      //         let a = arrows[i];
      //         a.x += cos(a.angle) * a.speed;
      //         a.y += sin(a.angle) * a.speed;
              
      //         push();
      //         translate(a.x, a.y);
      //         rotate(a.angle);
      //         fill(0, 255, 0, 10);
      //         triangle(-2.5, -2.5, -2.5, 2.5, 2.5, 0); // Arrow shape
      //         pop();
              
      //         // Remove arrows that reach their target
      //         if (dist(a.x, a.y, a.targetX, a.targetY) < 5) {
      //             arrows.splice(i, 1);
      //         }
      //     }

        // Particle generation
        noStroke();
        if (frameCount % 20 === 0) {
            layer.lines.forEach(l => {
              for (let i = 0; i < l.power / 20; i++) {

                const path = [l.from, ...(l.waypoints || []), l.to];

                layer.particles.push({
                  x: path[0].x,
                  y: path[0].y,
                  speed: random(0.1, 0.4),
                  path: path,
                  currentSegment: 0
                });
                
              }
            });
          }
        
      
        for (let i = layer.particles.length - 1; i >= 0; i--) {
              let p = layer.particles[i];

              // Get current segment
              let start = p.path[p.currentSegment];
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
    
              fill(255, 255, 0, 180);
              ellipse(p.x, p.y, 4, 4);
          }
          
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

          // // Reset shadow for next elements
          // drawingContext.shadowBlur = 0;

          fill(0);
          textAlign(CENTER, TOP);
          textSize(8);
          text(sub.name, sub.x, sub.y + size / 2 );
        });

  

      }
      

    // // 🎇 **Update and draw particles with smooth movement**
    // strokeWeight(0);
    // for (let i = particles.length - 1; i >= 0; i--) {
    //     let p = particles[i];

    //     // Move towards target
    //     let angle = atan2(p.targetY - p.y, p.targetX - p.x);
    //     p.x += cos(angle) * p.speed;
    //     p.y += sin(angle) * p.speed;

    //     fill(200, 200, 0, 180);
    //     ellipse(p.x, p.y, 4, 4); 

    //     // Remove particles when close to the target
    //     if (dist(p.x, p.y, p.targetX, p.targetY) < 5) {
    //         particles.splice(i, 1);
    //     }
    // }    
 
        
    
     // Draw substations
    //  noStroke();
    //  substations.forEach(sub => {
    //      let subColor = color(150); // Default gray
    //      let size = 4; // Default size
 
    //      if (sub.type === "380/220kV") {
    //          subColor = color(0, 255, 0); // Green
    //          size = 12;
    //      } else if (sub.type === "132kV") {
    //          subColor = color(255, 165, 0); // Orange
    //          size = 8;
    //      } else if (sub.type === "50kV") {
    //          subColor = color(0, 100, 255); // Blue
    //          size = 6;
    //      }
 
    //      fill(subColor);
    //      ellipse(sub.x, sub.y, size, size); // Use different sizes
    //      fill(0); // Black text
    //      textAlign(CENTER, TOP);
    //      textSize(4);
    //      text(sub.name, sub.x, sub.y + size / 2 + 2); // Below the circle
    //  }); 
   
    drawLegend();
    drawTitle();



    // ---------------- Plot timerseries --------------------
    let days = 7;
    let timevalues = 96;
    let n = days * timevalues;
    let margin = 50;


    // Find min/max for scaling
    let minVal = Infinity, maxVal = -Infinity;
    for (let r = 0; r < n; r++) {
      let val = P_table.getNum(r, colName);
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
    }

    // Draw line plot
    noFill();
    strokeWeight(4);
    beginShape();
    let row = 0;
    for (let d = 1; d < days+1; d++) {
        for (let t = 0; t < timevalues; t++) {
          let x1 = map(t, 0, timevalues - 1, gridWidth+100, canvasWidth - margin);
          let y1 = d*50
          let x2 = map(t, 0, timevalues - 1, gridWidth+100, canvasWidth - margin);
          let y2 = d*50 + 50;
          let val = P_table.getNum(row, colName);
          row = row+1
          // Map val to a color gradient (e.g., blue to red)
          let tmp = map(val, minVal, maxVal, 0, 1);
          let col = lerpColor(color(0, 100, 255), color(255, 0, 0), tmp);
          stroke(col);

          line(x1, y1, x2, y2);
        }
    }
    endShape();

    // circle(canvasWidth*0.75, canvasHeight*0.6, 400);
    // circle(canvasWidth*0.75, canvasHeight*0.6, 300);
    // circle(canvasWidth*0.75, canvasHeight*0.6, 200);

    // --- Circular bar plot with animation ---
    let cx = canvasWidth * 0.75;
    let cy = canvasHeight * 0.6;
    let radius = 180;
    let barMaxLen = 120;
    let barWidth = 2;
    let nBars = n; // one bar per time step
    let angleStep = TWO_PI / nBars;

    // If colName changed, update targetBarLens
    if (colName !== lastColName || targetBarLens.length !== nBars) {
      targetBarLens = [];
      for (let i = 0; i < nBars; i++) {
        let val = P_table.getNum(i, colName);
        let barLen = map(val, minVal, maxVal, 10, barMaxLen);
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
      let tmp = map(val, minVal, maxVal, 0, 1);
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
    noFill();
    stroke(200);
    strokeWeight(2);
    ellipse(cx, cy, radius * 2, radius * 2);

    // -----------------------------------------------
    noStroke();

    // Draw Mouse Pos onto screen
    if (substations.length > 0) {
      // Convert canvas to original coordinates
      let origX = map(mouseX, 50, gridWidth, minX, maxX);
      let origY = map(mouseY, 50, gridHeight, minY, maxY);
    
      // Optional: round for readability
      origX = nf(origX, 1, 0);  // or use toFixed()
      origY = nf(origY, 1, 0);
    
      // Draw background label
      fill(255, 255, 255, 200);
      rect(mouseX + 10, mouseY, 100, 30, 5);
    
      // Draw text
      fill(0);
      textSize(10);
      text(`X: ${origX}`, mouseX + 15, mouseY + 10);
      text(`Y: ${origY}`, mouseX + 15, mouseY + 22);
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
    textSize(10);
    let x = 20;
    let y = 40;
    
    text("Spannungsebene:",x,y-10);
    items.forEach((item, index) => {
      fill(item.visible ? item.color : 150);
      rect(x, y + index * 25, 15, 15, 3);
  
      fill(0);
      text(`[${item.key}] ${item.label}`, x + 25, y + index * 25 + 7);
    });
  }

  function drawTitle() {
    textAlign(CENTER, TOP);
    textSize(20);
    // textFont(klintFont);
    fill(255);
    text("Verteilnetze BKW und Umgebung inkl. Übertragungsnetz", canvasWidth / 2, 10);
  }


  
// Detect line click and update colName for timeseries plot
function mousePressed() {
  let minDist = 10; // px threshold for click
  let found = false;
  console.log("Mouse pressed at:", mouseX, mouseY);
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
        let t = ((mouseX - x0) * dx + (mouseY - y0) * dy) / (dx*dx + dy*dy);
        t = constrain(t, 0, 1);
        let px = x0 + t * dx;
        let py = y0 + t * dy;
        let d = dist(mouseX, mouseY, px, py);
        if (d < minDist) {
          colName = l.lineAbbrev;
          found = true;
        }
      }
    });
  }
  if (found) {
    print('Selected line:', colName);
  }
}