/**
 * reusableScatterplot
 *
 * Creates a reusable scatterplot chart component using D3.js.
 *
 * @returns {function} A chart function that can be called on a D3 selection.
 */
function reusableScatterplot() {
  // --- Default Configuration ---
  let width = 800;
  let height = 450;
  let margin = { top: 20, right: 110, bottom: 40, left: 60 };
  let xAxisLabel = "COST PER TASK ($)";
  let yAxisLabel = "SCORE (%)";
  let xAxisMin = 0.001;
  let xAxisMax = 1000;
  let yAxisMin = 0;
  let yAxisMax = 100; // Initial Y-axis max
  let showLabels = true;
  let labelPadding = 8; // Pixels between point and label
  let labelCollisionDetection = true;
  let labelFontSize = "10px";
  let labelColor = "#dbdbdb";
  let annotation = { 
    enabled: true,
    rect: {
      x1: 0.00101,
      y1: 99.9,
      x2: 0.41,
      y2: 85,
      fill: "rgba(235, 97, 97, 0.3)",
      stroke: "#666",
      strokeWidth: 0,
    },
    text: {
      content: "ARC-AGI-2 Grand Prize",
      style: "italic",
      x: 0.0012, // X position for text (in data space)
      y: 86.5, // Y position for text (in data space)
      fill: "#916b69",
      fontSize: "10px",
      letterSpacing: "0.1em",
    }
  };

  // --- Accessor Functions ---
  // These functions define how to get the necessary data properties from each datum
  let xValue = d => d.costPerTask;
  let yValue = d => d.score * 100;
  let idValue = d => `${d.modelId}-${d.datasetId}`; // Unique identifier for points
  let versionValue = d => d.datasetId;
  let providerValue = d => providersById[modelsById[d.modelId].providerId].displayName; // For color mapping
  let modelGroupValue = d => modelsById[d.modelId].modelGroup; // For connecting points within same group
  let labelValue = d => modelsById[d.modelId].displayName

  // --- Internal Variables ---
  let svg, g, x, y, xAxis, yAxis, pointsGroup, gridGroup, labelsGroup, linesGroup, annotationsGroup; // D3 selections and scales
  let initialized = false; // Flag to track if initial setup is done
  let fullData = []; // Store the complete dataset
  let originalXDomain = [xAxisMin, xAxisMax];
  let originalYDomain = [yAxisMin, yAxisMax];
  let currentHighlightSet = null; // Store the set of highlighted point IDs
  let quadtree; // Quadtree for efficient hover detection
  let tooltipDiv; // Tooltip element
  let hoverTarget = null; // Store the currently hovered point ID
  let currentColorMapping = {}; // Default empty object for custom color mappings
  let currentColorMode = "provider"; // Default to "provider" mode

  const highlightDimOpacity = 0.15;
  const highlightDimColor = "#555555";
  const hoverStrokeColor = "#ffffff"; // White stroke on hover
  const hoverStrokeWidth = 1.5;
  const hoverSearchRadius = 50; // Search radius for quadtree

  // --- Symbol Mapping ---
  const triangleSymbol = d3.symbol().type(d3.symbolTriangle).size(70);
  const circleSymbol = d3.symbol().type(d3.symbolCircle).size(60);

  const defaultColor = labelColor // "#ffdc00ff"; // Color for unknown values

  /**
   * The main chart function that processes the selection and data.
   * @param {d3.Selection} selection - The D3 selection to render the chart into.
   */
  function chart(selection) {
    selection.each(function(data) {
      console.log("SELECTION DATA", data);
      fullData = data; // Store the full dataset
      currentHighlightSet = null; // Reset highlight on new data

      // Calculate inner dimensions based on current width/height/margins
      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      // Store original domains from config
      originalXDomain = [xAxisMin, xAxisMax];
      originalYDomain = [yAxisMin, yAxisMax];

      // --- Initialize Scales ---
      x = d3.scaleLog()
        .domain(originalXDomain) // Use initial domain
        .range([0, innerWidth])
        .nice();

      y = d3.scaleLinear()
        .domain(originalYDomain) // Use initial domain
        .range([innerHeight, 0])
        .nice();

      // --- Initialize Axes ---
      xAxis = d3.axisBottom(x)
        .tickValues(getLogTickValues(x)) // Use helper for log ticks
        .tickFormat(formatXAxisTick) // Use helper for formatting
        .tickSizeOuter(0);

      yAxis = d3.axisLeft(y)
        .ticks(10) // Adjust number of ticks as needed
        .tickFormat(d => `${d}%`) // Format as percentage
        .tickSizeOuter(0);

      // --- SVG and Group Setup (run once) ---
      if (!initialized) {
        svg = d3.select(this).append("svg");
        g = svg.append("g");

        // Add background rect
        g.append("rect")
          .attr("class", "chart-background")
          .attr("fill", "#000"); // Black background

        // Add gridlines group (drawn before axes and points)
        gridGroup = g.append("g").attr("class", "grid-group");

        // Add axes groups
        g.append("g").attr("class", "x-axis axis");
        g.append("g").attr("class", "y-axis axis");

        // Add group for annotations (drawn after grid/axes, before points/lines)
        annotationsGroup = g.append("g").attr("class", "annotations-group");

        // Add group for model lines (between axes and points)
        linesGroup = g.append("g").attr("class", "model-lines-group");

        // Add points group
        pointsGroup = g.append("g").attr("class", "points-group");

        // Add labels group (after points so labels appear on top)
        labelsGroup = g.append("g").attr("class", "labels-group");

        // Add axis labels groups
        g.append("g").attr("class", "x-axis-label-group axis-label");
        g.append("g").attr("class", "y-axis-label-group axis-label");

        // --- NEW: Initialize Tooltip ---
        tooltipDiv = d3.select("body").selectAll(".chart-tooltip").data([null])
            .join("div") // Use join for enter/update
            .attr("class", "chart-tooltip")
            .style("position", "absolute")
            .style("opacity", 0)
            .style("background-color", "rgba(0, 0, 0, 0.9)")
            .style("color", "#fff")
            .style("padding", "8px 12px")
            .style("border-radius", "4px")
            .style("font-size", "12px")
            .style("pointer-events", "none") // Prevent tooltip from capturing mouse events
            .style("z-index", "10");

        initialized = true;
      }

      // Bind full data to SVG for potential later access
      svg.datum(fullData);

      // --- Update SVG and Group Dimensions ---
      svg.attr("width", width).attr("height", height);
      g.attr("transform", `translate(${margin.left},${margin.top})`);
      g.select(".chart-background")
        .attr("width", innerWidth)
        .attr("height", innerHeight);

      // --- Draw Grid Lines ---
      drawGridLines(gridGroup, x, y, innerWidth, innerHeight);

      // --- Draw Axes ---
      g.select(".x-axis")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(xAxis)
        .call(g => g.selectAll("text").attr("fill", "#9a9a9a")) // Style ticks
        .call(g => g.select(".domain").attr("stroke", "#555")); // Style axis line

      g.select(".y-axis")
        // .transition().duration(750) // No transition on initial draw
        .call(yAxis)
        .call(g => g.selectAll("text").attr("fill", "#9a9a9a")) // Style ticks
        .call(g => g.select(".domain").attr("stroke", "#555")); // Style axis line


      // --- Draw Axis Labels ---
      drawAxisLabels(g, innerWidth, innerHeight);

      // --- Draw Max Annotations ---
      drawMaxAnnotation(annotationsGroup, fullData, x, y, innerWidth, null, 0);

      // --- Draw Model Group Lines ---
      // Pass full data and null highlightSet for initial draw
      drawModelGroups(linesGroup, fullData, x, y, 0, null);

      // --- NEW: Draw Custom Annotation (if enabled) ---
      drawCustomAnnotation(annotationsGroup, x, y, 0);

      // --- Draw Points ---
      // Pass full data and null highlightSet for initial draw
      drawPoints(pointsGroup, fullData, x, y, 0, null);

      // --- Draw Labels (if enabled) ---
      if (showLabels) {
        // Pass full data and null highlightSet for initial draw
        drawLabels(labelsGroup, fullData, x, y, innerWidth, innerHeight, 0, null);
      } else {
        // Clear labels if disabled
        labelsGroup.selectAll(".point-label").remove();
      }

      // --- NEW: Setup Quadtree and Hover Listener ---
      setupQuadtreeAndHover(svg, fullData, x, y, innerWidth, innerHeight);
    });
  }

  // --- Helper Functions ---

  /** Calculates nice tick values for a log scale. */
  function getLogTickValues(logScale) {
    const [minVal, maxVal] = logScale.domain();
    const ticks = [];
    // Handle potential non-positive minVal for log scale
    const startMinVal = Math.max(minVal, Number.MIN_VALUE); // Ensure positive value
    const minExp = Math.floor(Math.log10(startMinVal));
    const maxExp = Math.ceil(Math.log10(maxVal));
    for (let i = minExp; i <= maxExp; i++) {
      ticks.push(Math.pow(10, i));
    }
    return ticks.filter(t => t >= startMinVal && t <= maxVal); // Ensure ticks are within domain
  }

  /** Formats X-axis ticks (e.g., $1K, $0.10). */
  function formatXAxisTick(d) {
    if (d >= 1000) return `$${(d / 1000).toFixed(0)}K`;
    if (d < 0.01) return `$${d.toExponential(0)}`; // Use exponential for very small
    if (d < 1) return `$${d.toFixed(2)}`; // Show cents for values < $1
    return `$${d.toFixed(0)}`;
  }

  /** Draws grid lines for both axes. */
  function drawGridLines(selection, xScale, yScale, w, h) {
      selection.selectAll("*").remove(); // Clear previous gridlines

      const xTickValues = getLogTickValues(xScale);

      // X grid lines (vertical)
      selection.append("g")
          .attr("class", "grid x-grid")
          .style("pointer-events", "none")
          .attr("transform", `translate(0,${h})`)
          .call(d3.axisBottom(xScale)
              .tickValues(xTickValues)
              .tickSize(-h)
              .tickFormat("")
          )
          .call(g => g.selectAll("line")
              .attr("stroke", "#333")
              .attr("stroke-opacity", 0.7))
          .call(g => g.select(".domain").remove());

      // Y grid lines (horizontal)
      selection.append("g")
          .attr("class", "grid y-grid")
          .style("pointer-events", "none")
          .call(d3.axisLeft(yScale)
              .ticks(10) // Match Y axis ticks
              .tickSize(-w)
              .tickFormat("")
          )
          .call(g => g.selectAll("line")
              .attr("stroke", "#333")
              .attr("stroke-opacity", 0.7))
          .call(g => g.select(".domain").remove());
  }


  /** Draws X and Y axis labels. */
  function drawAxisLabels(selection, w, h) {
    // X Axis Label
    let xLabel = selection.select(".x-axis-label-group").selectAll("text")
        .data([xAxisLabel]); // Use data join pattern
    xLabel.exit().remove();
    xLabel.enter().append("text")
        .attr("class", "axis-title")
        .attr("text-anchor", "middle")
        .attr("fill", "#dbdbdb")
        .attr("font-size", "12px") // Smaller font size
        .attr("letter-spacing", "0.15em") // Adjust spacing
        .merge(xLabel) // Merge enter and update selections
        .attr("x", w / 2)
        .attr("y", h + margin.bottom - 5) // Position below axis ticks
        .text(d => d);

    // Y Axis Label
    let yLabel = selection.select(".y-axis-label-group").selectAll("text")
        .data([yAxisLabel]);
    yLabel.exit().remove();
    yLabel.enter().append("text")
        .attr("class", "axis-title")
        .attr("transform", "rotate(-90)")
        .attr("text-anchor", "middle")
        .attr("fill", "#dbdbdb")
        .attr("font-size", "12px") // Smaller font size
        .attr("letter-spacing", "0.15em") // Adjust spacing
        .merge(yLabel)
        .attr("x", -h / 2)
        .attr("y", -margin.left + 15) // Position left of axis ticks
        .text(d => d);
  }

  /** Draws horizontal lines and text for max scores per version */
  function drawMaxAnnotation(selection, data, xScale, yScale, innerWidth, highlightSet = null, duration = 0) {
      // selection.selectAll("*").remove(); // Clear previous annotations

      const versions = ["ARC-AGI-1", "ARC-AGI-2"];
      const annotationData = [];

      // Determine the data subset to use for max calculation
      const relevantData = highlightSet ? data.filter(d => highlightSet.has(idValue(d))) : data;

      versions.forEach(v => {
          // Filter the *relevant* data for the current version (excluding Human for max calc)
          const versionData = relevantData.filter(d => d.version === v && d.Provider !== "Human");
          // Still find Human data from the *full* dataset for comparison context
          const humanData = data.find(d => d.version === v && d.Provider === "Human");
          console.log("HUMAN DATA", humanData); // Keep original human data lookup

          if (versionData.length > 0) {
              const maxEntry = versionData.reduce((max, p) => p.score > max.score ? p : max, versionData[0]);
              let diffText = "";
              if (humanData && maxEntry) { // Check if maxEntry exists
                  const diff = humanData.score - maxEntry.score;
                  // Only show diff if positive, indicating human is higher
                  if (diff > 0) {
                     diffText = `(${diff.toFixed(1)}% < Human)`;
                  } else if (diff < 0) {
                     // Optional: Indicate if max in set is higher than human
                     // diffText = ` (${Math.abs(diff).toFixed(1)}% > Human)`;
                  } else {
                     // Optional: Indicate if scores are equal
                     // diffText = ` (matches Human)`;
                  }
              }
              annotationData.push({
                  version: v,
                  score: maxEntry.score, // Use the score from the maxEntry within the subset
                  // yPos calculation moved to drawing phase to use latest scale
                  text: `Max${highlightSet ? ' (in selection)' : ''}: ${maxEntry.score.toFixed(1)}%`, // Update text
                  diff: diffText
              });
          }
          // Optional: Handle case where versionData is empty (no points of this version in selection)
          // else {
          //   annotationData.push({ version: v, score: null, text: `${v}: No data in selection`, diff: "" });
          // }
      });


      // --- Drawing Logic (Lines and Text) ---
      // Data join uses annotationData calculated above
      const lines = selection.selectAll(".annotation-line")
          .data(annotationData.filter(d => d.score !== null), d => d.version); // Filter out entries with no score

      lines.exit()
          .transition("anno-line-exit").duration(duration / 2)
          .attr("opacity", 0)
          .remove(); // Use remove()

      const linesEnter = lines.enter()
          .append("line")
          .attr("class", "annotation-line")
          .attr("x1", 0)
          .attr("x2", innerWidth)
          .attr("y1", d => yScale(d.score)) // Initial position
          .attr("y2", d => yScale(d.score)) // Initial position
          .attr("stroke", "#888")
          .attr("stroke-width", 1)
          .attr("opacity", 0) // Start transparent
          .attr("stroke-dasharray", "4,4");

      lines.merge(linesEnter)
          // .attr("opacity", 0.33) // Opacity set in transition
          .transition("anno-line-update").duration(duration)
          .attr("x2", innerWidth) // Update width in case it changed
          .attr("y1", d => yScale(d.score)) // Transition to new y position
          .attr("y2", d => yScale(d.score)) // Transition to new y position
          .attr("opacity", 0.5); // Fade in/maintain opacity


      // Draw Text Annotations
       const texts = selection.selectAll(".annotation-text")
           .data(annotationData.filter(d => d.score !== null), d => d.version); // Filter out entries with no score

      texts.exit()
          .transition("anno-text-exit").duration(duration / 2)
          .attr("opacity", 0)
          .remove(); // Use remove()

      const textsEnter = texts.enter()
          .append("text")
          .attr("class", "annotation-text")
          .attr("x", innerWidth + 5) // Initial position
          .attr("y", d => yScale(d.score)) // Initial position
          .attr("dy", "0.35em") // Adjusted dy for better alignment
          .attr("text-anchor", "start")
          .attr("fill", "#ccc")
          .style("font-size", "10px")
          .attr("opacity", 0); // Start transparent

      // Append tspans within the enter selection
      textsEnter.append("tspan")
          .attr("class", "annotation-text-version") // Class for main text
          .attr("x", innerWidth + 5) // Position relative to parent text start
          .text(d => d.version);

      textsEnter.append("tspan")
          .attr("class", "annotation-text-main") // Class for main text
          .attr("x", innerWidth + 5) // Position relative to parent text start
          .attr("dy", "1.2em") // Adjust dy for spacing below main text
          .text(d => d.text);
      textsEnter.append("tspan")
          .attr("class", "annotation-text-diff")
          .attr("x", innerWidth + 5) // Position relative to parent text start
          // .attr("y", d => yScale(d.score)) // y is controlled by parent text
          .attr("dy", "2.4em") // Adjust dy for spacing below main text
          .attr("text-anchor", "start")
          .attr("fill", "#aaa") // Slightly different color for diff
          .style("font-style", "italic")
          .text(d => d.diff);

      texts.merge(textsEnter)
           .transition("anno-text-update").duration(duration)
           .attr("x", innerWidth + 5) // Transition x (in case innerWidth changed)
           .attr("y", d => yScale(d.score)) // Transition y
           .attr("opacity", 1); // Fade in/maintain opacity

      // Update tspans within the merged selection
      texts.merge(textsEnter).select(".annotation-text-main")
           .text(d => d.text); // Update main text content
      texts.merge(textsEnter).select(".annotation-text-diff")
          .attr("x", innerWidth + 5) // Keep x aligned
          // .attr("y", d => yScale(d.score)) // Y position is handled by the parent text element
          .attr("dy", "1.2em") // Keep relative positioning
          .text(d => d.diff); // Update diff text content
  }

  /**
   * Draws the point labels with collision detection and transitions.
   * Handles highlighting by only drawing labels for the highlighted subset.
   * @param {d3.Selection} selection - The group element for labels.
   * @param {Array} data - The *full* dataset.
   * @param {d3.Scale} xScale - The X scale.
   * @param {d3.Scale} yScale - The Y scale.
   * @param {number} innerWidth - Chart inner width.
   * @param {number} innerHeight - Chart inner height.
   * @param {number} [duration=0] - Transition duration.
   * @param {Set|null} highlightSet - Set of IDs for highlighted points, or null if none.
   */
  function drawLabels(selection, data, xScale, yScale, innerWidth, innerHeight, duration = 0, highlightSet = null) {
    const targetLabels = {}; // Store target positions for collision detection

    // Determine the data to use for labels (only highlighted ones if set)
    const labelData = highlightSet ? data.filter(d => highlightSet.has(idValue(d))) : data;

    // Calculate target positions first for *potentially* visible labels
    labelData.forEach(d => {
      targetLabels[idValue(d)] = {
        id: idValue(d),
        x: xScale(xValue(d)) + labelPadding,
        y: yScale(yValue(d))
      };
    });

    // Data Join using labelData
    const labels = selection.selectAll(".point-label")
      .data(labelData, d => idValue(d));

    // Exit: Transition out labels that are removed (no longer highlighted or removed from data)
    labels.exit()
      .transition("label-exit").duration(duration / 2)
      .attr("opacity", 0)
      .remove();

    // Enter: Add new labels, starting transparent and at target position
    const labelsEnter = labels.enter().append("text")
      .attr("class", d => `point-label label-${versionValue(d)} provider-${providerValue(d).replace(/\s+/g, '-').toLowerCase()}`)
      .attr("x", d => targetLabels[idValue(d)].x) // Start at target X
      .attr("y", d => targetLabels[idValue(d)].y) // Start at target Y
      .attr("dy", "0.35em")
      .attr("text-anchor", "start")
      .attr("font-size", labelFontSize)
      
      .attr("data-id", d => idValue(d))
      .attr("opacity", 0) // Start transparent
      .style("pointer-events", "none")
      .text(d => labelValue(d));

    // Update + Enter: Transition both new and existing labels to final position/opacity
    const labelsUpdate = labels.merge(labelsEnter)
      // .attr("opacity", 0) // Opacity transition handled below or by collision
      .transition("label-position").duration(duration) // Named transition
      .attr("x", d => targetLabels[idValue(d)].x)
      .attr("y", d => targetLabels[idValue(d)].y)
      .attr("fill", d => {
        // if (highlightSet && !highlightSet.has(idValue(d))) {
        //   return highlightDimColor;
        // }
        
        let colorKey;
        if (currentColorMode === "provider") {
          colorKey = providerValue(d);
        } else if (currentColorMode === "version") {
          colorKey = versionValue(d);
        } else { // type or any other mode
          colorKey = modelsById[d.modelId].modelType;
        }
        console.log("COLOR KEY", colorKey, currentColorMapping[colorKey])
        
        return currentColorMapping[colorKey] || labelColor;
      })
      // .attr("opacity", 1); // Fade in/stay visible (collision might hide later)


    // --- Collision Detection (Applied after transitions conceptually) ---
    if (!labelCollisionDetection) {
      // If collision detection is disabled, ensure all are visible after transition
      // labelsUpdate.attr("opacity", 1); // Already set above
      return; // No need for further collision logic
    }

    // Run collision detection after the main position transition *ends*
    labelsUpdate.on("end.collision", () => { // Named listener
      // Get all label elements *after* transition that are part of the current join
      const finalLabelElements = selection.selectAll(".point-label")
          .filter(d => labelData.some(ld => idValue(ld) === idValue(d))) // Ensure we only check currently relevant labels
          .nodes();

      if (finalLabelElements.length === 0) return; // No labels to check

      // Create array to track which labels to keep visible
      const labelsToKeep = new Set();

      // Only need point positions for the *visible* labels for collision checks
       const pointPositions = labelData.map(d => ({
        id: idValue(d),
        x: xScale(xValue(d)),
        y: yScale(yValue(d))
      }));

      // Sort labels (e.g., left to right) for consistent resolution
      const sortedFinalLabels = finalLabelElements
        .map(el => {
            try {
                // Ensure element exists and has getBBox method
                if (!el || typeof el.getBBox !== 'function') {
                    console.warn("Invalid element for BBox:", el);
                    return null;
                }
                const bbox = el.getBBox();
                // Basic check for valid BBox dimensions
                if (bbox.width <= 0 || bbox.height <= 0) {
                     console.warn("Invalid BBox dimensions for label:", el, bbox);
                    // return null; // Treat as problematic if needed
                }
                return {
                    element: el,
                    bbox: bbox, // Get final BBox
                    id: el.getAttribute("data-id"),
                    x: parseFloat(el.getAttribute("x")) // Use final 'x' attribute
                };
            } catch (e) {
                console.warn("Could not get BBox for label:", el, e);
                return null; // Handle cases where BBox fails (e.g., element removed unexpectedly)
            }
        })
        .filter(l => l !== null && l.id) // Filter out problematic labels or those missing id
        .sort((a, b) => a.x - b.x);


      // Process labels for collision
      for (const label of sortedFinalLabels) {
         // Skip if label has no valid bbox
        if (!label.bbox || label.bbox.width <= 0 || label.bbox.height <= 0) continue;

        let hasCollision = false;
        const labelBounds = { // Calculate bounds based on final BBox
          left: label.bbox.x - 2,
          right: label.bbox.x + label.bbox.width + 2,
          top: label.bbox.y - 2,
          bottom: label.bbox.y + label.bbox.height + 2
        };

        // Check collision with points *within the visible set*
        for (const point of pointPositions) {
          if (point.id === label.id) continue; // Don't collide with own point
          if (point.x >= labelBounds.left && point.x <= labelBounds.right &&
              point.y >= labelBounds.top && point.y <= labelBounds.bottom) {
            hasCollision = true;
            break;
          }
        }

        // Check collision with already kept labels
        if (!hasCollision) {
          for (const keptLabelId of labelsToKeep) {
             const keptLabel = sortedFinalLabels.find(l => l.id === keptLabelId);
             if (!keptLabel || !keptLabel.bbox || keptLabel.bbox.width <= 0 || keptLabel.bbox.height <= 0) continue; // Skip invalid kept labels
             const keptBounds = {
                left: keptLabel.bbox.x - 2,
                right: keptLabel.bbox.x + keptLabel.bbox.width + 2,
                top: keptLabel.bbox.y - 2,
                bottom: keptLabel.bbox.y + keptLabel.bbox.height + 2
             };
            // Simple Axis-Aligned Bounding Box (AABB) collision check
            if (!(labelBounds.right < keptBounds.left || labelBounds.left > keptBounds.right ||
                  labelBounds.bottom < keptBounds.top || labelBounds.top > keptBounds.bottom)) {
              hasCollision = true;
              break;
            }
          }
        }

        if (!hasCollision) {
          labelsToKeep.add(label.id);
        }
      }

      // Apply final visibility based on collision detection (no transition here, just set final state)
       selection.selectAll(".point-label")
         .filter(function() { // Use a function to access the element's data-id
            const currentId = d3.select(this).attr("data-id");
            return labelsToKeep.has(currentId);
         })
         // .transition().duration(duration / 4) // Optional: Short fade in for kept labels
         .attr("opacity", 1); // Ensure kept labels are visible

       selection.selectAll(".point-label")
         .filter(function() {
             const currentId = d3.select(this).attr("data-id");
            return !labelsToKeep.has(currentId);
         })
         // .transition().duration(duration / 4) // Optional: Short fade out for removed labels
         .attr("opacity", 0)
         .style("pointer-events", "none"); // Disable events on hidden labels

    });

    // --- Previous Collision Logic Removed ---
    // The complex sorting and bounding box checks are now inside the transition's "end" callback.
  }


  /**
   * Draws the scatterplot points (circles/triangles) with highlighting.
   * @param {d3.Selection} selection - The group element for points.
   * @param {Array} data - The *full* dataset.
   * @param {d3.Scale} xScale - The X scale.
   * @param {d3.Scale} yScale - The Y scale.
   * @param {number} [duration=750] - Transition duration.
   * @param {Set|null} highlightSet - Set of IDs for globally highlighted points.
   */
  function drawPoints(selection, data, xScale, yScale, duration = 750, highlightSet = null) {
      const points = selection.selectAll(".point")
          .data(data, d => idValue(d));

      points.exit()
          .transition("point-exit").duration(duration / 2)
          .attr("opacity", 0)
          .remove();

      const pointsEnter = points.enter().append("path")
          .attr("class", d => {
            return `point point-${versionValue(d)} provider-${providerValue(d).replace(/\s+/g, '-').toLowerCase()}`
            })
          .attr("pointer-events", "none")
          .attr("data-id", d => idValue(d)) // Add data-id here
          .attr("d", d => versionValue(d).indexOf('v1') === 0 ? circleSymbol() : triangleSymbol())
          .attr("transform", d => `translate(${xScale(xValue(d))}, ${yScale(yValue(d))})`)
          .attr("opacity", 0);

      points.merge(pointsEnter)
           .transition("point-update").duration(duration)
           .attr("transform", d => `translate(${xScale(xValue(d))}, ${yScale(yValue(d))})`)
           .attr("opacity", d => (!highlightSet || highlightSet.has(idValue(d))) ? 1 : highlightDimOpacity)
           .attr("fill", d => {
             if (highlightSet && !highlightSet.has(idValue(d))) {
               return highlightDimColor;
             }
             
             let colorKey;
             if (currentColorMode === "provider") {
               colorKey = providerValue(d);
             } else if (currentColorMode === "version") {
               colorKey = versionValue(d);
             } else { // type or any other mode
               colorKey = modelsById[d.modelId].modelType;
             }
             
             return currentColorMapping[colorKey] || defaultColor;
           })
           .attr("stroke", d => (hoverTarget && idValue(d) === hoverTarget) ? hoverStrokeColor : "none") // Apply hover stroke
           .attr("stroke-width", d => (hoverTarget && idValue(d) === hoverTarget) ? hoverStrokeWidth : 0) // Apply hover stroke width
           .attr("d", d => { // Adjust symbol size on hover
               const baseSymbol = versionValue(d).indexOf('v1') === 0 ? circleSymbol : triangleSymbol;
               if (hoverTarget && idValue(d) === hoverTarget) {
                   const hoverSize = (versionValue(d).indexOf('v1') === 0 ? circleSymbol.size()() : triangleSymbol.size()()) * 1.5; // Increase size
                   return baseSymbol.size(hoverSize)();
               }
               return baseSymbol(); // Use original size
           });
  }


  /**
   * Draws curved lines connecting points within the same model group with transitions and highlighting.
   * @param {d3.Selection} selection - The group element for lines.
   * @param {Array} data - The *full* dataset.
   * @param {d3.Scale} xScale - The X scale.
   * @param {d3.Scale} yScale - The Y scale.
   * @param {number} [duration=750] - Transition duration.
   * @param {Set|null} highlightSet - Set of IDs for globally highlighted points.
   */
  function drawModelGroups(selection, data, xScale, yScale, duration = 750, highlightSet = null) {

    const lineData = []; // Array to hold data for each line segment

    // Helper to check if a line should be fully visible in highlight mode
    const shouldShowLine = (points, hSet) => {
        if (!hSet) return true; // No highlight, show all
        return points.every(p => hSet.has(idValue(p)));
    };

    // If model groups config is empty, don't draw any lines
    if (Object.keys(modelGroups).length > 0) {
        // Process each data source in modelGroups
        Object.keys(modelGroups).forEach(groupDataSource => { 
          // groupDataSource is the datasetId
          // Get model groups to connect for this data source
          const groupsToConnect = modelGroups[groupDataSource];

          if (!groupsToConnect || groupsToConnect.length === 0) return;

          // Process each specific model group name (e.g., "GPT-4")
          groupsToConnect.forEach(modelGroupName => {
             // Find the points using the full dataset
             const versionPoints = data.filter(d => modelGroupValue(d) === modelGroupName && versionValue(d) === groupDataSource)
                                       .sort((a, b) => xValue(a) - xValue(b)); // Sort by cost

            // Check if we have enough points for lines in each version
            if (versionPoints.length >= 2) {
                let colorKey;
                if (currentColorMode === "provider") {
                    colorKey = providerValue(versionPoints[0]);
                } else if (currentColorMode === "version") {
                    colorKey = versionValue(versionPoints[0]);
                } else { // type or any other mode
                    colorKey = modelsById[versionPoints[0].modelId].modelType;
                }
                
                lineData.push({
                    id: `${modelGroupName}-${groupDataSource}`,
                    points: versionPoints,
                    color: currentColorMapping[colorKey] || defaultColor,
                    groupName: modelGroupName,
                    version: groupDataSource
                });
            }
             
          });
        });
    }

    // Line generator function
    const line = d3.line()
      .x(d => xScale(xValue(d)))
      .y(d => yScale(yValue(d)))
      .curve(d3.curveCardinal.tension(0.5));

    console.log("LINE DATA", lineData)
    // Data Join for lines
    const lines = selection.selectAll(".model-group-line")
      .data(lineData, d => d.id); // Use the generated ID

    // Exit: Transition out old lines (if groups/versions change)
    lines.exit()
      .transition("line-exit").duration(duration / 2)
      .attr("opacity", 0)
      // .remove();

    // Enter: Add new lines, starting transparent
    const linesEnter = lines.enter().append("path")
      .attr("class", d => `model-group-line`) 
      .attr("pointer-events", "none")
      .attr("d", d => line(d.points)) // Initial 'd' based on points
      .attr("fill", "none")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,3")
      .attr("opacity", 0); // Start transparent

    // Update + Enter: Transition shape and opacity/color based on highlight
    lines.merge(linesEnter)
      .attr("data-group", d => d.groupName) // Store group name for potential hover interactions
      .attr("data-version", d => d.version)
      .transition("line-update").duration(duration)
      .attr("opacity", d => shouldShowLine(d.points, highlightSet) ? 0.8 : highlightDimOpacity * 0.5) // Target opacity
      .attr("stroke", d => shouldShowLine(d.points, highlightSet) ? d.color : highlightDimColor) // Update color
      .attr("d", d => line(d.points)); // Transition the path shape

 }

  /**
   * Sets up the quadtree and hover listeners.
   * @param {d3.Selection} svgSelection - The main SVG selection.
   * @param {Array} data - The *full* dataset.
   * @param {d3.Scale} xScale - The X scale.
   * @param {d3.Scale} yScale - The Y scale.
   * @param {number} innerWidth - Chart inner width.
   * @param {number} innerHeight - Chart inner height.
   */
  function setupQuadtreeAndHover(svgSelection, data, xScale, yScale, innerWidth, innerHeight) {
      // 1. Create Quadtree
      quadtree = d3.quadtree()
          .x(d => xScale(xValue(d)))
          .y(d => yScale(yValue(d)))
          .extent([[0, 0], [innerWidth, innerHeight]]) // Use chart inner bounds
          .addAll(data); // Add *all* data points

      // 2. Add Listener to SVG background or a dedicated hover rect
      // Using the background rect already present
      const hoverRect = g.select(".chart-background");
      // Or add a dedicated one:
      // const hoverRect = g.selectAll(".hover-capture-rect").data([null])
      //     .join("rect")
      //     .attr("class", "hover-capture-rect")
      //     .attr("width", innerWidth)
      //     .attr("height", innerHeight)
      //     .attr("fill", "none") // Make it invisible
      //     .style("pointer-events", "all"); // Ensure it captures events

      hoverRect
          .on("mousemove.tooltip", (event) => {
              const [xm, ym] = d3.pointer(event, g.node()); // Get mouse coords relative to 'g'

              // Find nearest point using quadtree
              const closest = quadtree.find(xm, ym, hoverSearchRadius); // Search within radius

              const closestId = closest ? idValue(closest) : null;

              // If the closest point changed, update hover state
              if (hoverTarget !== closestId) {
                  const previousTargetId = hoverTarget;
                  hoverTarget = closestId; // Update the global hover target

                  // Update the previously hovered point (remove hover style)
                  if (previousTargetId) {
                       updatePointHoverStyle(previousTargetId, false);
                  }
                  // Update the newly hovered point (add hover style)
                  if (hoverTarget) {
                       updatePointHoverStyle(hoverTarget, true);
                       showTooltip(event, closest);
                  } else {
                       hideTooltip();
                  }
              } else if (hoverTarget) {
                   // If hovering over the same point, just update tooltip position
                   showTooltip(event, closest);
              }

          })
          .on("mouseout.tooltip", () => {
              // If mouse leaves the chart area, clear hover state
              if (hoverTarget) {
                  const previousTargetId = hoverTarget;
                  hoverTarget = null;
                   updatePointHoverStyle(previousTargetId, false);
                  hideTooltip();
              }
          });
  }

  /**
   * Updates the visual style of a point based on hover state.
   * @param {string} pointId - The ID of the point to update.
   * @param {boolean} isHovered - True if the point is being hovered.
   */
  function updatePointHoverStyle(pointId, isHovered) {
      pointsGroup.selectAll(`.point[data-id="${pointId}"]`)
          .transition("point-hover-style").duration(50) // Short transition
          .attr("stroke", isHovered ? hoverStrokeColor : "none")
          .attr("stroke-width", isHovered ? hoverStrokeWidth : 0)
          .attr("d", function(d) {
              const baseSymbol = versionValue(d).indexOf('v1') === 0 ? circleSymbol : triangleSymbol;
              const originalSize = (versionValue(d).indexOf('v1') === 0 ? 60 : 70); // Assuming these were the original sizes
              if (isHovered) {
                  return baseSymbol.size(originalSize * 1.5)(); // Use size() method
              } else {
                  return baseSymbol.size(originalSize)(); // Restore original size
              }
          });
      // Also potentially highlight label?
       if (showLabels) {
            labelsGroup.selectAll(`.point-label[data-id="${pointId}"]`)
                .transition("label-hover-style").duration(50)
                .attr("font-weight", isHovered ? "bold" : "normal");
        }
  }

  /** Shows and positions the tooltip. */
  function showTooltip(event, d) {
      tooltipDiv.transition().duration(100).style("opacity", 1);
      const isGloballyHighlighted = !currentHighlightSet || currentHighlightSet.has(idValue(d));
      const scoreDisplay = (yValue(d)).toFixed(1) + '%';
      let costDisplay = 'N/A';
      const costVal = xValue(d);
      if (costVal !== null && costVal !== undefined) {
          if (costVal < 0.01) costDisplay = "$" + costVal.toFixed(4); // Exp for very small
          else if (costVal < 1) costDisplay = "$" + costVal.toFixed(3);
          else if (costVal < 1000) costDisplay = "$" + costVal.toFixed(2);
          else costDisplay = "$" + (costVal / 1000).toFixed(1) + "K";
      }
      tooltipDiv.html(`
          ${labelValue(d)}<br/>
          Score: ${scoreDisplay}<br/>
          Cost/Task: ${costDisplay}<br/>
          Provider: ${providerValue(d)}
          ${!isGloballyHighlighted ? '<br/><i>(Filtered out)</i>' : ''}
      `)
      // Position tooltip relative to the page, not the SVG element
      .style("left", (event.pageX + 15) + "px")
      .style("top", (event.pageY - 10) + "px");
  }

  /** Hides the tooltip. */
  function hideTooltip() {
      tooltipDiv.transition().duration(200).style("opacity", 0);
  }

  /**
   * Highlights a subset of data points, updating axes and dimming others.
   * @param {Array|null} highlightData - An array of data objects to highlight, or null/empty to reset.
   * @param {number} [duration=750] - Transition duration.
   */
  chart.highlightPoints = function(highlightData, duration = 750) {
      if (!initialized) return;

      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      let targetXDomain, targetYDomain;
      let newHighlightSet = null;

      // Check for reset condition
      if (!highlightData || highlightData.length === 0) {
          targetXDomain = originalXDomain;
          targetYDomain = originalYDomain;
          newHighlightSet = null;
      } else {
          newHighlightSet = new Set(highlightData.map(idValue));

          // Calculate bounds from highlightData
          let [minX, maxX] = d3.extent(highlightData, xValue);
          let [minY, maxY] = d3.extent(highlightData, yValue);

          // Add padding (e.g., 15%) - careful with log scale
          const xRange = maxX - minX;
          const yRange = maxY - minY;

          // For log scale, adjust padding multiplicatively
          minX = Math.max(originalXDomain[0], minX / 1.15); // Don't go below original min
          maxX = Math.min(originalXDomain[1], maxX * 1.15); // Don't go above original max
          console.log("minX", minX);
          console.log("maxX", maxX);

          minY = Math.max(0, minY - yRange * 0.15); // Ensure minY doesn't go below 0
          maxY = Math.min(originalYDomain[1], maxY + yRange * 0.15); // Don't exceed original max
          console.log("minY", minY);
          console.log("maxY", maxY);

          // Prevent zero or negative range for log scale
          if (minX <= 0) minX = originalXDomain[0] * 0.1; // Fallback if min becomes non-positive
          if (maxX <= minX) maxX = minX * 10; // Ensure max > min

           // Ensure Y range is valid
           if (maxY <= minY) {
              maxY = minY + (originalYDomain[1] - originalYDomain[0]) * 0.1; // Add small default range if needed
           }

          // TODO: Do we want to update the X domain? Uncomment to do it, but it seems dissorienting.
          // targetXDomain = [minX, maxX];
          // targetYDomain = [minY, maxY];
          // lock the minY to 0
          targetYDomain = [originalYDomain[0], maxY];
      }

      // Update the global highlight set *before* drawing
      currentHighlightSet = newHighlightSet;

      // Update scales
      // x.domain(targetXDomain).nice();
      y.domain(targetYDomain).nice();
      // console.log("targetXDomain", targetXDomain);
      console.log("targetYDomain???", targetYDomain);

      // Update Axes with transition
      g.select(".x-axis")
         .transition("x-axis-highlight").duration(duration)
         .call(xAxis.scale(x).tickValues(getLogTickValues(x))) // Update scale and ticks
         .call(g => g.selectAll("text").attr("fill", "#9a9a9a"))
         .call(g => g.select(".domain").attr("stroke", "#555"));

      g.select(".y-axis")
         .transition("y-axis-highlight").duration(duration)
         .call(yAxis.scale(y)) // Update scale
         .call(g => g.selectAll("text").attr("fill", "#9a9a9a"))
         .call(g => g.select(".domain").attr("stroke", "#555"));

      // Redraw Grid Lines (instantly)
      drawGridLines(gridGroup, x, y, innerWidth, innerHeight);

      // Redraw Annotations, passing the new currentHighlightSet
      drawMaxAnnotation(annotationsGroup, fullData, x, y, innerWidth, currentHighlightSet, duration);

      // Redraw Points with transition, using the new highlight set
      drawPoints(pointsGroup, fullData, x, y, duration, currentHighlightSet);

      // Redraw Labels with transition, using the new highlight set
      if (showLabels) {
         drawLabels(labelsGroup, fullData, x, y, innerWidth, innerHeight, duration, currentHighlightSet);
      } else {
         labelsGroup.selectAll(".point-label")
             .transition("label-hide-highlight").duration(duration / 2)
             .attr("opacity", 0)
             .remove();
      }

      // Redraw Model Group Lines with transition, using the new highlight set
      drawModelGroups(linesGroup, fullData, x, y, duration, currentHighlightSet);

      drawCustomAnnotation(annotationsGroup, x, y, duration);

      // --- NEW: Update Quadtree ---
      // Rebuild quadtree because scales changed
       setupQuadtreeAndHover(svg, fullData, x, y, innerWidth, innerHeight);

      return chart;
  };

  /**
   * Draws a custom rectangle and text annotation based on config, using enter/update/exit.
   * @param {d3.Selection} selection - The group element for annotations.
   * @param {d3.Scale} xScale - The X scale.
   * @param {d3.Scale} yScale - The Y scale.
   * @param {number} [duration=0] - Transition duration.
   */
  function drawCustomAnnotation(selection, xScale, yScale, duration = 0) {
      // Data for the annotation elements - an array containing the config if enabled, else empty
      const annotationData = annotation.enabled &&
                             annotation.rect.x1 !== null && annotation.rect.y1 !== null &&
                             annotation.rect.x2 !== null && annotation.rect.y2 !== null &&
                             annotation.text.x !== null && annotation.text.y !== null
                           ? [annotation] : []; // Wrap config in array if valid and enabled

      // --- Annotation Rectangle ---
      const rects = selection.selectAll(".custom-annotation-rect")
          .data(annotationData, d => "custom-annotation-rect"); // Use a constant key

      // Exit: Fade out and remove rectangle if data is empty (annotation disabled/invalid)
      rects.exit()
          .transition("anno-rect-exit").duration(duration / 2)
          .attr("opacity", 0)
          .remove();

      // Enter: Add new rectangle if data exists (annotation enabled/valid)
      const rectsEnter = rects.enter().append("rect")
          .attr("class", "custom-annotation-rect")
          .attr("x", d => xScale(d.rect.x1))
          .attr("y", d => yScale(d.rect.y1))
          .attr("width", d => Math.abs(xScale(d.rect.x2) - xScale(d.rect.x1)))
          .attr("height", d => Math.abs(yScale(d.rect.y2) - yScale(d.rect.y1)))
          .attr("fill", d => d.rect.fill)
          .attr("stroke", d => d.rect.stroke)
          .attr("stroke-width", d => d.rect.strokeWidth)
          .attr("opacity", 0); // Start transparent

      // Update + Enter: Transition existing and new rectangles to final state
      rects.merge(rectsEnter)
          .transition("anno-rect-update").duration(duration)
          .attr("x", d => xScale(d.rect.x1))
          .attr("y", d => yScale(d.rect.y1))
          .attr("width", d => Math.abs(xScale(d.rect.x2) - xScale(d.rect.x1)))
          .attr("height", d => Math.abs(yScale(d.rect.y2) - yScale(d.rect.y1)))
          .attr("fill", d => d.rect.fill) // Update style in case config changed
          .attr("stroke", d => d.rect.stroke)
          .attr("stroke-width", d => d.rect.strokeWidth)
          .attr("opacity", 1); // Fade in/stay visible


      // --- Annotation Text ---
      const texts = selection.selectAll(".custom-annotation-text")
          .data(annotationData, d => "custom-annotation-text"); // Use a constant key

      // Exit: Fade out and remove text if data is empty
      texts.exit()
          .transition("anno-text-exit").duration(duration / 2)
          .attr("opacity", 0)
          .remove();

      // Enter: Add new text if data exists
      const textsEnter = texts.enter().append("text")
          .attr("class", "custom-annotation-text")
          .attr("x", d => xScale(d.text.x))
          .attr("y", d => yScale(d.text.y))
          .attr("fill", d => d.text.fill)
          .attr("font-size", d => d.text.fontSize)
          .attr("letter-spacing", d => d.text.letterSpacing)
          .attr("font-style", d => d.text.style)
          .text(d => d.text.content)
          .attr("opacity", 0); // Start transparent

      // Update + Enter: Transition existing and new text to final state
      texts.merge(textsEnter)
          .transition("anno-text-update").duration(duration)
          .attr("x", d => xScale(d.text.x))
          .attr("y", d => yScale(d.text.y))
          .attr("fill", d => d.text.fill) // Update style in case config changed
          .attr("font-size", d => d.text.fontSize)
          .attr("letter-spacing", d => d.text.letterSpacing)
          .attr("font-style", d => d.text.style)
          .text(d => d.text.content) // Update text content
          .attr("opacity", 1); // Fade in/stay visible
  }

  // --- NEW: Getter for Color Mapping ---
  chart.getColorMapping = function() {
    return { ...currentColorMapping };
  };

  chart.setColorMapping = function(colorMap, colorMode) {
    console.log("SET COLOR MAPPING", colorMap, colorMode);
    currentColorMapping = colorMap || {};
    currentColorMode = colorMode || "provider";
    
    // If the chart is initialized, redraw with new colors
    if (initialized) {
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;
        const duration = 750;
        
        // Redraw all elements that need color updates
        drawPoints(pointsGroup, fullData, x, y, duration, currentHighlightSet);
        drawModelGroups(linesGroup, fullData, x, y, duration, currentHighlightSet);
        
        if (showLabels) {
            drawLabels(labelsGroup, fullData, x, y, innerWidth, innerHeight, duration, currentHighlightSet);
        }
    }
    
    return this;
  };

  // --- Configuration Getter/Setters ---
  // Allow users to configure chart parameters after initialization

  chart.width = function(_) {
    return arguments.length ? (width = +_, chart) : width;
  };

  chart.height = function(_) {
    return arguments.length ? (height = +_, chart) : height;
  };

  chart.margin = function(_) {
    if (!arguments.length) return margin;
    margin.top = typeof _.top !== 'undefined' ? +_.top : margin.top;
    margin.right = typeof _.right !== 'undefined' ? +_.right : margin.right;
    margin.bottom = typeof _.bottom !== 'undefined' ? +_.bottom : margin.bottom;
    margin.left = typeof _.left !== 'undefined' ? +_.left : margin.left;
    return chart;
  };

  // Update config setters to potentially store original values if needed elsewhere
  chart.xAxisMin = function(_) {
    if (!arguments.length) return xAxisMin;
    xAxisMin = +_;
    originalXDomain[0] = xAxisMin; // Update original domain store
    if (initialized) x.domain(originalXDomain).nice(); // Update scale if initialized
    if (initialized) {
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;
        setupQuadtreeAndHover(svg, fullData, x, y, innerWidth, innerHeight); // Update quadtree
    }
    return chart;
  };

  chart.xAxisMax = function(_) {
     if (!arguments.length) return xAxisMax;
     xAxisMax = +_;
     originalXDomain[1] = xAxisMax; // Update original domain store
     if (initialized) x.domain(originalXDomain).nice(); // Update scale if initialized
     if (initialized) {
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;
        setupQuadtreeAndHover(svg, fullData, x, y, innerWidth, innerHeight); // Update quadtree
    }
    return chart;
  };

  // Note: yAxisMin/Max are controlled by updateYAxis or highlightPoints after initial setup
  chart.yAxisMin = function(_) {
     if (!arguments.length) return yAxisMin;
     yAxisMin = +_;
     originalYDomain[0] = yAxisMin; // Update original domain store
     if (initialized && !currentHighlightSet) {
        y.domain(originalYDomain).nice();
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;
        setupQuadtreeAndHover(svg, fullData, x, y, innerWidth, innerHeight); // Update quadtree
    }
    return chart;
  };
   chart.yAxisMax = function(_) {
     if (!arguments.length) return yAxisMax;
     yAxisMax = +_;
     originalYDomain[1] = yAxisMax; // Update original domain store
     if (initialized && !currentHighlightSet) {
        y.domain(originalYDomain).nice();
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;
        setupQuadtreeAndHover(svg, fullData, x, y, innerWidth, innerHeight); // Update quadtree
    }
    return chart;
  };

  chart.xAxisLabel = function(_) {
    return arguments.length ? (xAxisLabel = _, chart) : xAxisLabel;
  };

  chart.yAxisLabel = function(_) {
    return arguments.length ? (yAxisLabel = _, chart) : yAxisLabel;
  };

  chart.xValue = function(_) {
    return arguments.length ? (xValue = typeof _ === 'function' ? _ : () => _, chart) : xValue;
  };

   chart.yValue = function(_) {
    return arguments.length ? (yValue = typeof _ === 'function' ? _ : () => _, chart) : yValue;
  };

  chart.idValue = function(_) {
    return arguments.length ? (idValue = typeof _ === 'function' ? _ : () => _, chart) : idValue;
  };

   chart.versionValue = function(_) {
    return arguments.length ? (versionValue = typeof _ === 'function' ? _ : () => _, chart) : versionValue;
  };

   chart.providerValue = function(_) {
    return arguments.length ? (providerValue = typeof _ === 'function' ? _ : () => _, chart) : providerValue;
  };

  chart.modelGroupValue = function(_) {
    return arguments.length ? (modelGroupValue = typeof _ === 'function' ? _ : () => _, chart) : modelGroupValue;
  };

  // Removed dataSourceValue as it wasn't used
  // chart.dataSourceValue = function(_) {
  //   return arguments.length ? (dataSourceValue = typeof _ === 'function' ? _ : () => _, chart) : dataSourceValue;
  // };

  // --- Configuration Getter/Setters for Labels ---
  chart.showLabels = function(_) {
    if (!arguments.length) return showLabels;
    const previousState = showLabels;
    showLabels = !!_; // Ensure boolean
    if (initialized && previousState !== showLabels) { // Only update if state changes
      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;
      // const data = svg.datum() || []; // Use fullData
      const duration = 300; // Short transition for toggle

      if (showLabels) {
        // Draw labels with a short fade-in transition, respecting highlight
        drawLabels(labelsGroup, fullData, x, y, innerWidth, currentHighlightSet);
      } else {
        // Fade out and remove labels
        labelsGroup.selectAll(".point-label")
          .transition().duration(duration)
          .attr("opacity", 0)
          .remove();
      }
    }
    return chart;
  };

  chart.labelCollisionDetection = function(_) {
    return arguments.length ? (labelCollisionDetection = !!_, chart) : labelCollisionDetection;
  };

  chart.labelPadding = function(_) {
    return arguments.length ? (labelPadding = +_, chart) : labelPadding;
  };

  chart.labelFontSize = function(_) {
    return arguments.length ? (labelFontSize = _, chart) : labelFontSize;
  };

  chart.labelColor = function(_) {
    return arguments.length ? (labelColor = _, chart) : labelColor;
  };

  chart.annotation = function(_) {
    if (!arguments.length) return annotation;
    // Deep merge might be better, but for now, simple override
    annotation = { ...annotation, ..._ };
    // Optionally redraw if enabled and initialized
    if (initialized) { // Redraw regardless of enabled state to handle removal
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;
        // Redraw immediately (or with short duration) using the updated annotation state
        drawCustomAnnotation(annotationsGroup, x, y, 100);
    }
    return chart;
  };

  

  return chart;
}


