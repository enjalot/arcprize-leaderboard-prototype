/**
 * createLeaderboardChart
 *
 * Builds an interactive leaderboard chart + table for model performance.
 *
 * @param {String} containerId - The ID of the HTML container to host the chart
 * @param {String} dataUrl - URL (or local path) to the CSV data source
 * @param {Object} options - Optional configuration overrides
 */
function createLeaderboardChart(containerId, dataUrl, options = {}) {
  /***************************************************************************
   * DEFAULT CONFIGURATION
   ***************************************************************************/
  const defaults = {
    // Sizing
    width: null, // If null, we use the container's width dynamically
    height: 450,
    margin: { top: 4, right: 40, bottom: 40, left: 60 },

    // Axis Labels
    xAxisLabel: "COST PER TASK ($)",
    yAxisLabel: "SCORE (%)",

    // Axis Limits (if null, they'll auto-calc from data)
    xAxisMin: 0.001,
    xAxisMax: 1000,
    yAxisMin: 0,
    yAxisMax: 100,

    // Which data source to select by default
    dataSources: ["v1_Semi_Private", "v2_Semi_Private"],

    //  Model groups to draw a line between
    modelGroupsToDrawLinesBetween: {
      v1_Semi_Private: ["o3", "Claude_3_7_thinking", "o3-mini", "o1"],
    },

    // Data points to filter out
    dataPointsToFilterOut: [
      "o3-high",
      "stem_grad",
    ],

    showLabelMapping: {
      "v1_Public_Eval": true,
      "v1_Semi_Private": true,
      "v1_Private_Eval": true,
      "v2_Public_Eval": true,
      "v2_Semi_Private": false,
      "v2_Private_Eval": true,
    },

    // Rectangle annotation
    annotation: {
      enabled: true,
      rect: {
        x1: 0.00101, // Top-left x coordinate (in data space)
        y1: 99.9, // Top-left y coordinate (in data space)
        x2: .41, // Bottom-right x coordinate (in data space)
        y2: 85, // Bottom-right y coordinate (in data space)
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
      },
    },

    labelPositionAdjustments: {
      "o1 - high": { x: 5, y: -10 },
      "o1 - medium": { x: 5, y: 10 },
      "o3-low": { x: 5, y: 12 },
      "mturker": { x: 0, y: -10 },
      "o3-mini-high": { x: -120, y: -5 },
      "o3-mini-medium": { x: -140, y: 5 },
      "o3-mini-low": { x: -110, y: -2 },
      "Claude 3.7 Thinking 16K": { x: -30, y: -13 },
      "Claude 3.7 Thinking 1K": { x: 0, y: -5 },
      "gpt-4.5-preview-2025-02-27": { x: 0, y: 10 },
      "Icecuber": { x: 0, y: -5 },
      "Llama-4-Scout-17B-16E-Instruct-together": { x: 0, y: -5 },
      // Add more adjustments as needed
    },
  };

  // Merge defaults with provided options
  const config = { ...defaults, ...options };

  /***************************************************************************
   * DATA SOURCE METADATA
   ***************************************************************************/
  const dataSources = {
    v1_Public_Eval: {
      scoreColumn: "v1_Public_Eval_Score",
      costColumn: "v1_Public_Eval_Cost_Per_Task",
      dataSetDisplayName: "ARC-AGI-1 Public Eval",
    },
    v1_Semi_Private: {
      scoreColumn: "v1_Semi_Private_Score",
      costColumn: "v1_Semi_Private_Cost_Per_Task",
      dataSetDisplayName: "ARC-AGI-1 Semi-Private",
    },
    v1_Private_Eval: {
      scoreColumn: "v1_Private_Eval_Score",
      costColumn: "v1_Private_Eval_Cost_Per_Task",
      dataSetDisplayName: "ARC-AGI-1 Private Eval",
    },
    v2_Public_Eval: {
      scoreColumn: "v2_Public_Eval_Score",
      costColumn: "v2_Public_Eval_Cost_Per_Task",
      dataSetDisplayName: "ARC-AGI-2 Public Eval",
    },
    v2_Semi_Private: {
      scoreColumn: "v2_Semi_Private_Score",
      costColumn: "v2_Semi_Private_Cost_Per_Task",
      dataSetDisplayName: "ARC-AGI-2 Semi-Private",
    },
    v2_Private_Eval: {
      scoreColumn: "v2_Private_Eval_Score",
      costColumn: "v2_Private_Eval_Cost_Per_Task",
      dataSetDisplayName: "ARC-AGI-2 Private Eval",
    },
  };

  labelColorMapping = {
    "provider" : {
      "OpenAI": "#1e93ffff",
      "Google": "#4ecc30ff",
      "Anthropic": "#f93c32ff",
      "Meta": "#e43ba2ff",
      "ARC Prize 2024": "#ff841cff",
      "Human": "#a9a9a9ff",
      "Other": "#ffdc00ff",
    },
    "dataSources": {
      "v1_Public_Eval": "#1e93ffff",
      "v1_Semi_Private": "#ffdc00ff",
      "v1_Private_Eval": "#f93c32ff",
      "v2_Public_Eval": "#1e93ffff",
      "v2_Semi_Private": "#e43ba2ff",
      "v2_Private_Eval": "#a9a9a9ff",
    },
    "other": "#ffdc00ff"
  }

  // Easier iteration in pivoting the data
  const evaluationTypes = Object.keys(dataSources).map((key) => ({
    name: key,
    scoreColumn: dataSources[key].scoreColumn,
    costColumn: dataSources[key].costColumn,
  }));

  // Set a variable to track the currently focused version
  let focusedVersion = null; // null means no focus (show everything normally)

  /***************************************************************************
   * SETUP THE CONTAINER
   ***************************************************************************/
  // Select the container and clear anything that's already there
  const container = d3.select(`#${containerId}`);
  container.html("");

  // If width is not provided, derive it from the container
  if (!config.width) {
    config.width = container.node().getBoundingClientRect().width;
  }

  // Calculate the usable width and height inside margins
  const width = config.width - config.margin.left - config.margin.right;
  const height = config.height - config.margin.top - config.margin.bottom;

  /***************************************************************************
   * APPEND SVG & GROUP
   ***************************************************************************/
  const svg = container
    .append("svg")
    .attr("width", config.width)
    .attr("height", config.height)
    .append("g")
    .attr("transform", `translate(${config.margin.left},${config.margin.top})`);

  // A black background behind the chart
  svg
    .append("rect")
    .attr("width", width + config.margin.left + config.margin.right)
    .attr("height", height + config.margin.top + config.margin.bottom)
    .attr("x", -config.margin.left)
    .attr("y", -config.margin.top)
    .attr("fill", "#000");

  /***************************************************************************
   * AXIS LABELS
   ***************************************************************************/
  // X-axis label
  svg
    .append("text")
    .attr("class", "axis-label x-axis-label")
    .attr("x", width / 2)
    .attr("y", height + config.margin.bottom)
    .attr("text-anchor", "middle")
    .attr("fill", "#dbdbdb")
    .attr("font-size", "14px")
    .attr("letter-spacing", "0.2em")
    .text(config.xAxisLabel);

  // Y-axis label
  svg
    .append("text")
    .attr("class", "axis-label y-axis-label")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -config.margin.left + 10)
    .attr("text-anchor", "middle")
    .attr("fill", "#dbdbdb")
    .attr("font-size", "14px")
    .attr("letter-spacing", "0.2em")
    .text(config.yAxisLabel);

  /***************************************************************************
   * TOOLTIP
   ***************************************************************************/
  const tooltip = container
    .append("div")
    .attr("class", "tooltip")
    .style("opacity", 0)
    // Add these styles directly to make the tooltip visible
    .style("position", "absolute")
    .style("background-color", "rgba(0, 0, 0, 1)")
    .style("color", "#fff")
    .style("padding", "8px")
    .style("border-radius", "4px")
    .style("font-size", "12px")
    .style("pointer-events", "none") // This prevents the tooltip from interfering with mouse events
    .style("z-index", "10");

  /***************************************************************************
   * DATA SOURCE SELECTION CHECKBOXES
   ***************************************************************************/
  const dataSourceOptions = [
    // { key: "v1_Semi_Private", display: "ARC-AGI-1" },
    // { key: "v2_Semi_Private", display: "ARC-AGI-2" },
  ];

  // Create a container for the checkboxes
  const dropdownContainer = container
    .append("div")
    .attr("class", "data-source-dropdown-container")
    .style("text-align", "center")
    .style("margin-bottom", "10px");

  // Label for checkboxes
  // dropdownContainer
  //   .append("label")
  //   .text("Data: ")
  //   .style("color", "#dbdbdb")
  //   .style("margin-right", "10px");

  // Generate a checkbox for each data source
  dataSourceOptions.forEach((option) => {
    const checkboxId = `${containerId}-${option.key}`;
    // Get the color from labelColorMapping
    const backgroundColor = labelColorMapping["dataSources"][option.key] || labelColorMapping["other"];

    const checkboxContainer = dropdownContainer
      .append("span")
      .attr("class", "source-checkbox-container")
      .attr("id", `container-${checkboxId}`)
      .style("margin-right", "15px")
      .style("padding", "3px 8px")
      .style("border-radius", "4px")
      .style("cursor", "pointer")
      // Set background color based on the dataset color with reduced opacity
      .style("background-color", backgroundColor + "33") // Adding 33 for 20% opacity
      .style("transition", "background-color 0.2s ease");

    const checkbox = checkboxContainer
      .append("input")
      .attr("type", "checkbox")
      .attr("id", checkboxId)
      .attr("value", option.key)
      // Check both boxes by default
      .property("checked", true)
      .style("margin-right", "5px");

    checkboxContainer
      .append("label")
      .attr("for", checkboxId)
      .text(option.display)
      .style("color", "#dbdbdb");

    // Update the click handler to maintain colored backgrounds
    checkboxContainer.on("click", function () {
      const isChecked = checkbox.property("checked");
      checkbox.property("checked", !isChecked);
      // Update background color based on checked state
      d3.select(this).style("background-color", !isChecked ? backgroundColor + "33" : backgroundColor + "66");
      updateSelectedDataSources();
    });
  });

  let selectedDataSources = ["v1_Semi_Private", "v2_Semi_Private"];

  function updateSelectedDataSources() {
    selectedDataSources = [];
    dataSourceOptions.forEach((option) => {
      const box = document.getElementById(`${containerId}-${option.key}`);
      const container = document.getElementById(
        `container-${containerId}-${option.key}`
      );
      const backgroundColor = labelColorMapping["dataSources"][option.key] || labelColorMapping["other"];

      if (box && box.checked) {
        selectedDataSources.push(option.key);
        // Highlight active source with more opacity
        if (container) container.style.backgroundColor = backgroundColor + "66";
      } else {
        // Reduce opacity for inactive source
        if (container) container.style.backgroundColor = backgroundColor + "33";
      }
    });

    // If no box is selected, revert to both sources
    if (selectedDataSources.length === 0) {
      ["v1_Semi_Private", "v2_Semi_Private"].forEach(source => {
        const defaultBox = document.getElementById(`${containerId}-${source}`);
        const defaultContainer = document.getElementById(
          `container-${containerId}-${source}`
        );
        // Add this line to get the correct color for each source
        const backgroundColor = labelColorMapping["dataSources"][source] || labelColorMapping["other"];

        if (defaultBox) {
          defaultBox.checked = true;
          selectedDataSources.push(source);
          if (defaultContainer) defaultContainer.style.backgroundColor = backgroundColor + "66";
        }
      });
    }

    updateChart();
  }

  /***************************************************************************
   * updateChart
   ***************************************************************************/
  function updateChart() {
    // Clear all existing elements in the SVG (axes, lines, circles, etc.)
    svg.selectAll("*").remove();

    // Re-draw black background
    svg
      .append("rect")
      .attr("width", width + config.margin.left + config.margin.right)
      .attr("height", height + config.margin.top + config.margin.bottom)
      .attr("x", -config.margin.left)
      .attr("y", -config.margin.top)
      .attr("fill", "#000");

    // Re-add axis labels
    svg
      .append("text")
      .attr("class", "axis-label x-axis-label")
      .attr("x", width / 2)
      .attr("y", height + config.margin.bottom)
      .attr("text-anchor", "middle")
      .attr("fill", "#dbdbdb")
      .attr("font-size", "14px")
      .attr("letter-spacing", "0.2em")
      .text(config.xAxisLabel);

    svg
      .append("text")
      .attr("class", "axis-label y-axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -config.margin.left + 10)
      .attr("text-anchor", "middle")
      .attr("fill", "#dbdbdb")
      .attr("font-size", "14px")
      .attr("letter-spacing", "0.2em")
      .text(config.yAxisLabel);

    // Fetch data
    d3.csv(dataUrl).then((rawData) => {
      const transformedData = pivotData(rawData);

      // Filter for displayed + selected sources
      const displayData = transformedData.filter((d) => {
        return d.display && selectedDataSources.includes(d.evaluation_type) && !config.dataPointsToFilterOut.includes(d.Config);
      });

      // Add console logging to see the data points
      // console.log("Selected data sources:", selectedDataSources);
      // console.log("Data points to be displayed:", displayData);
      // console.log("Raw transformed data (before filtering):", transformedData);

      if (displayData.length === 0) return;

      // Sort data by descending score
      displayData.sort((a, b) => b.score - a.score);

      // Create scales
      const { x, y } = createScales(displayData);

      // Draw grid lines
      drawGridLines(x, y);

      // Draw axes
      drawAxes(x, y);

      // Circles
      drawCircles(displayData, x, y);

      // Labels
      drawLabels(displayData, x, y);
      
      // Draw curved lines between model groups
      drawModelGroupLines(displayData, x, y);

      // Annotation
      drawAnnotation(x, y);

      // Expose data if needed
      window.leaderboardData = displayData;
      document.dispatchEvent(
        new CustomEvent("leaderboardChartReady", { detail: displayData })
      );
    });
  }

  /***************************************************************************
   * PIVOT / TRANSFORM DATA
   ***************************************************************************/
  function pivotData(rawData) {
    return rawData.flatMap((row) => {
      const baseFields = {
        Provider: row.Provider,
        Config: row.Config,
        Display_Name: row.Display_Name,
        Model_Type: row.Model_Type,
        Model_Group: row.Model_Group,
        display:
          row.display === "true" ||
          row.display === "True" ||
          row.display === true,
        Model_Release_Date: row.Model_Release_Date,
      };

      const pivoted = evaluationTypes.map((et) => {
        const score = row[et.scoreColumn] ? +row[et.scoreColumn] : null;
        const cost = row[et.costColumn] ? +row[et.costColumn] : null;
        const dataSetDisplayName = dataSources[et.name].dataSetDisplayName;
        if (score !== null && cost !== null) {
          const isV1 = et.name.startsWith('v1_');
          const performance = isV1 ? 
            (score * 100) : // For v1: multiply by 100 to convert to percentage
            (score * 100);  // For v2: also multiply by 100 to convert to percentage
          
          return {
            ...baseFields,
            evaluation_type: et.name,
            score: score,
            performance: performance,
            cost: cost,
            dataSetDisplayName: dataSetDisplayName,
          };
        }
        return null;
      });

      return pivoted.filter((d) => d !== null);
    });
  }

  /***************************************************************************
   * CREATE SCALES
   *
   * Uses config.xAxisMin / config.xAxisMax if specified; otherwise, uses data
   * min/max (rounded out to neat log steps).
   ***************************************************************************/
  function createScales(displayData) {
    const minCost = d3.min(displayData, (d) => d.cost);
    const maxCost = d3.max(displayData, (d) => d.cost);

    // If the user did NOT provide xAxisMin / xAxisMax explicitly,
    // compute them from data in a "log-friendly" way:
    const autoXMin =
      minCost > 0 ? Math.pow(10, Math.floor(Math.log10(minCost))) : 0.0001;

    const autoXMax =
      maxCost > 0 ? Math.pow(10, Math.ceil(Math.log10(maxCost))) : 10;

    // If config.xAxisMin / xAxisMax is not null, use that; else auto
    const domainMin = config.xAxisMin != null ? config.xAxisMin : autoXMin;
    const domainMax = config.xAxisMax != null ? config.xAxisMax : autoXMax;

    // Calculate dynamic y-axis max based on data
    const maxPerformance = d3.max(displayData, d => d.performance);
    const dynamicMax = Math.ceil(maxPerformance / 10) * 10; // Round up to nearest 10%

    // X scale (log)
    const x = d3
      .scaleLog()
      .domain([domainMin, domainMax])
      .range([0, width])
      .nice(); // snap to "nice" powers of 10

    // Y scale now uses dynamicMax instead of config.yAxisMax
    const y = d3
      .scaleLinear()
      .domain([config.yAxisMin, config.yAxisMax])
      .range([height, 0])
      .nice();

    return { x, y };
  }

  /***************************************************************************
   * getLogTickValues
   *
   * Helper to produce an array of powers-of-10 between x.domain()[0] and x.domain()[1].
   ***************************************************************************/
  function getLogTickValues(xScale) {
    const [xMin, xMax] = xScale.domain();
    const ticks = [];
    const minExp = Math.floor(Math.log10(xMin));
    const maxExp = Math.ceil(Math.log10(xMax));

    for (let i = minExp; i <= maxExp; i++) {
      ticks.push(Math.pow(10, i));
    }
    return ticks;
  }

  /***************************************************************************
   * DRAW GRID LINES
   ***************************************************************************/
  function drawGridLines(x, y) {
    const xTickValues = getLogTickValues(x);

    // X-axis grid lines (vertical)
    svg
      .append("g")
      .attr("class", "grid x-grid")
      .attr("transform", `translate(0,${height})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(xTickValues)
          .tickSize(-height)
          .tickFormat(() => "")
      )
      .call(g => {
        g.selectAll("line")
          .attr("stroke", "#333")
          .attr("stroke-opacity", 0.3);
        g.selectAll("path")
          .attr("stroke", "none");
      });

    // Y-axis grid lines (horizontal)
    svg
      .append("g")
      .attr("class", "grid y-grid")
      .call(
        d3
          .axisLeft(y)
          .ticks(10)
          .tickSize(-width)
          .tickFormat(() => "")
      )
      .call(g => {
        g.selectAll("line")
          .attr("stroke", "#333")
          .attr("stroke-opacity", 0.3);
        g.selectAll("path")
          .attr("stroke", "none");
      });
  }

  /***************************************************************************
   * DRAW AXES
   ***************************************************************************/
  function drawAxes(x, y) {
    const xTickValues = getLogTickValues(x);

    // Bottom (X) axis
    const xAxis = d3
      .axisBottom(x)
      .tickValues(xTickValues)
      .tickFormat((d) => {
        if (d >= 1000) {
          return `$${(d / 1000).toFixed(1)}K`;
        } else if (d === 0.1) {
          // Example for a small special case
          return `$0.10`;
        }
        return `$${d}`;
      })
      .tickSizeOuter(0);

    // Left (Y) axis
    const yAxis = d3
      .axisLeft(y)
      .ticks(10)
      .tickFormat((d) => `${d}%`)
      .tickSizeOuter(0);

    svg
      .append("g")
      .attr("class", "axis x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(xAxis)
      .call((g) => g.selectAll("text").attr("fill", "#9a9a9a"));

    svg
      .append("g")
      .attr("class", "axis y-axis")
      .call(yAxis)
      .call((g) => g.selectAll("text").attr("fill", "#9a9a9a"));
  }

  /***************************************************************************
   * DRAW CIRCLES
   ***************************************************************************/
  function drawCircles(displayData, x, y) {
    // Clear any global references if you rely on them
    window.leaderboardDots = {};

    // Create a path generator for triangles
    const triangleSymbol = d3.symbol().type(d3.symbolTriangle).size(70);

    // Create a container for all data points
    const points = svg.selectAll(".dot")
      .data(displayData)
      .enter();

    // Draw circles for V1 data points
    points.filter(d => !d.evaluation_type.startsWith('v2_'))
      .append("circle")
      .attr("class", "dot")
      .attr(
        "id",
        (d) => `dot-${d.Config.replace(/\s+/g, "_")}-${d.evaluation_type}`
      )
      .attr("data-source", (d) => d.evaluation_type)
      .attr("data-version", "v1") // Add data-version attribute
      .attr("cx", (d) => x(d.cost))
      .attr("cy", (d) => y(d.performance))
      .attr("r", 5)
      .attr("fill", (d) => getCircleFillColor(d, focusedVersion))
      .attr("stroke", "none") // Remove stroke
      .attr("stroke-width", 0) // Set stroke width to 0
      .on("mouseover", handleMouseOver)
      .on("mouseout", handleMouseOut);

    // Draw triangles for V2 data points
    points.filter(d => d.evaluation_type.startsWith('v2_'))
      .append("path")
      .attr("class", "dot triangle")
      .attr(
        "id",
        (d) => `dot-${d.Config.replace(/\s+/g, "_")}-${d.evaluation_type}`
      )
      .attr("data-source", (d) => d.evaluation_type)
      .attr("data-version", "v2") // Add data-version attribute
      .attr("d", triangleSymbol)
      .attr("transform", d => `translate(${x(d.cost)},${y(d.performance)})`)
      .attr("fill", (d) => getCircleFillColor(d, focusedVersion))
      .attr("stroke", "none") // Remove stroke
      .attr("stroke-width", 0) // Set stroke width to 0
      .on("mouseover", handleMouseOver)
      .on("mouseout", handleMouseOut);

    // Define the mouseover handler function
    function handleMouseOver(event, d) {
      const mouseX = event.pageX;
      const mouseY = event.pageY;

      tooltip.transition().duration(100).style("opacity", 1);
      
      // Updated score display logic
      const scoreDisplay = d.score !== null && d.score !== undefined 
        ? (d.evaluation_type.startsWith('v1_')
            ? ((d.score < 1 ? d.score * 100 : d.score).toFixed(2))
            : (d.score * 100).toFixed(2)  // For v2, always multiply by 100
          ) + '%'
        : 'N/A';
      // Check if cost exists before trying to format it
      let costDisplay = 'N/A';
      if (d.cost !== null && d.cost !== undefined) {
        if (d.cost < 1) {
          costDisplay = "$" + d.cost.toFixed(3);
        } else if (d.cost < 1000) {
          costDisplay = "$" + d.cost.toFixed(2);
        } else {
          costDisplay = "$" + (d.cost / 1000).toFixed(1) + "K";
        }
      }

      // Use the dataSetDisplayName from dataSources instead of raw evaluation_type
      const datasetName = dataSources[d.evaluation_type]?.dataSetDisplayName || d.evaluation_type;

      tooltip
        .html(
          `
        Model: ${d.Display_Name || 'Unknown'}<br/>
        Dataset: ${datasetName}<br/>
        Score: ${scoreDisplay}<br/>
        Cost/Task: ${costDisplay}
      `
        )
        .style("left", mouseX + 10 + "px")
        .style("top", mouseY - 28 + "px");

      window.leaderboardDots[d.Config] = this;
    }

    // Define the mouseout handler function
    function handleMouseOut() {
      tooltip.transition().duration(300).style("opacity", 0);
    }
  }

  /***************************************************************************
   * DRAW LABELS
   ***************************************************************************/
  function drawLabels(displayData, x, y) {
    // Filter the data to only include items where showLabelMapping is true for V1
    // For V2, include them all but set initial opacity based on config
    const excludedConfigs = ["Claude 3.7"];
    
    // Filter for v1 labels (using existing showLabelMapping)
    const v1FilteredData = displayData.filter(d => 
      d.evaluation_type.startsWith('v1_') && 
      config.showLabelMapping[d.evaluation_type] && 
      !excludedConfigs.includes(d.Config)
    );
    
    // Include ALL v2 labels regardless of config - we'll control visibility through CSS
    const v2FilteredData = displayData.filter(d => 
      d.evaluation_type.startsWith('v2_') && 
      !excludedConfigs.includes(d.Config)
    );
    
    // Combine the data for rendering
    const combinedData = [...v1FilteredData, ...v2FilteredData];
    
    svg
      .selectAll(".label")
      .data(combinedData)
      .enter()
      .append("text")
      .attr("class", d => d.evaluation_type.startsWith('v1_') ? "label v1-label" : "label v2-label")
      .attr("data-source", (d) => d.evaluation_type)
      .attr("data-version", d => d.evaluation_type.startsWith('v1_') ? "v1" : "v2")
      .attr("x", (d) => {
        // Apply x adjustment if specified in the config
        const baseX = x(d.cost) + 10;
        const adjustment = config.labelPositionAdjustments[d.Config]?.x || 0;
        return baseX + adjustment;
      })
      .attr("y", (d) => {
        // Apply y adjustment if specified in the config
        const baseY = y(d.performance);
        const adjustment = config.labelPositionAdjustments[d.Config]?.y || 0;
        return baseY + adjustment;
      })
      .text((d) => {
        if (selectedDataSources.length > 1) {
          return `${d.Display_Name}`;
        }
        return d.Display_Name;
      })
      .attr("fill", (d) => getCircleFillColor(d, focusedVersion))
      .attr("font-size", "11px")
      .attr("letter-spacing", "0.2em")
      .attr("alignment-baseline", "middle")
      // Set initial visibility for v2 labels based on current focus state and config
      .attr("opacity", d => {
        if (d.evaluation_type.startsWith('v2_')) {
          // Show if this v2 label should be visible based on config OR if v2 is focused
          return (config.showLabelMapping[d.evaluation_type] || focusedVersion === "v2") ? 1 : 0;
        }
        return 1; // V1 labels start visible
      });
  }

  /***************************************************************************
   * DRAW ANNOTATION RECTANGLE AND TEXT
   ***************************************************************************/
  function drawAnnotation(x, y) {
    if (!config.annotation.enabled) return;

    const rect = config.annotation.rect;
    const text = config.annotation.text;

    // Draw rectangle
    svg
      .append("rect")
      .attr("class", "annotation-rect")
      .attr("x", x(rect.x1))
      .attr("y", y(rect.y1))
      .attr("width", x(rect.x2) - x(rect.x1))
      .attr("height", y(rect.y2) - y(rect.y1))
      .attr("fill", rect.fill)
      .attr("stroke", rect.stroke)
      .attr("stroke-width", rect.strokeWidth);

    // Draw text
    svg
      .append("text")
      .attr("class", "annotation-text")
      .attr("x", x(text.x))
      .attr("y", y(text.y))
      .attr("fill", text.fill)
      .attr("font-size", text.fontSize)
      .attr("letter-spacing", text.letterSpacing)
      .attr("font-style", text.style)
      .text(text.content);
  }

  /***************************************************************************
   * GET CIRCLE FILL COLOR
   * Returns the appropriate fill color based on the data point
   * V2 data points are blue, V1 data points are colored by provider
   * When v2 is focused, v2 points get colored by provider too
   ***************************************************************************/
  function getCircleFillColor(dataPoint, currentFocus = null) {
    const isV1 = dataPoint.evaluation_type.startsWith('v1_');
    const isV2 = dataPoint.evaluation_type.startsWith('v2_');
    
    // Normal behavior for v1 points - always show provider color
    // if (isV1) {
    //   return labelColorMapping["provider"][dataPoint.Provider] || labelColorMapping["other"];
    // }
    
    // // For v2 points - when v2 is in focus, show provider color, otherwise show default v2 color
    // if (isV2) {
    //   if (currentFocus === "v2") {
    //     // When v2 is focused, use provider colors for v2 data points
    //     return labelColorMapping["provider"][dataPoint.Provider] || labelColorMapping["other"];
    //   } else {
    //     // Default behavior - use v2 dataset color
    //     return labelColorMapping["dataSources"]["v2_Semi_Private"];
    //   }
    // }
    
    // Default color for any other case
    return labelColorMapping["provider"][dataPoint.Provider] || labelColorMapping["other"]
    // return labelColorMapping["other"];
  }

  /***************************************************************************
   * DRAW CURVED LINES BETWEEN MODEL GROUPS
   ***************************************************************************/
  function drawModelGroupLines(displayData, x, y) {
    // For each data source in config.modelGroupsToDrawLinesBetween
    Object.keys(config.modelGroupsToDrawLinesBetween).forEach(dataSource => {
      // Get the model groups to connect for this data source
      const modelGroups = config.modelGroupsToDrawLinesBetween[dataSource];
      
      if (!modelGroups || modelGroups.length === 0) return; // Need at least 1 group
      
      // Process each model group separately
      modelGroups.forEach(modelGroup => {
        // Filter data to only include points from this data source and this specific model group
        const groupPoints = displayData.filter(d => 
          d.evaluation_type === dataSource && 
          d.Model_Group === modelGroup
        );
        
        // Sort points by cost (x-axis value) for proper line drawing
        groupPoints.sort((a, b) => a.cost - b.cost);
        
        if (groupPoints.length < 2) return; // Need at least 2 points to draw a line
        
        // Create curved line generator
        const line = d3.line()
          .x(d => x(d.cost))
          .y(d => y(d.performance))
          .curve(d3.curveCardinal.tension(0.5)); // Use cardinal curve with moderate tension
        
        // Determine line color from the first point in the group
        const lineColor = getCircleFillColor(groupPoints[0]);
        
        // Draw the path for this group
        svg.append("path")
          .datum(groupPoints)
          .attr("class", `model-group-line ${modelGroup}`)
          .attr("d", line)
          .attr("fill", "none")
          .attr("stroke", lineColor)
          .attr("stroke-width", 2)
          .attr("stroke-dasharray", "5,3") // Optional: make it dashed
          .attr("opacity", 0.8);
      });
    });
  }

  /***************************************************************************
   * CONNECT HOVER HIGHLIGHTS FROM HTML
   ***************************************************************************/
  function setupVersionHighlights() {
    // Find the version indicators directly in the document since they're outside the container
    const arcagi1Indicator = document.querySelector('#leaderboard-chart + div svg circle').closest('div');
    const arcagi2Indicator = document.querySelector('#leaderboard-chart + div svg polygon').closest('div');
    
    // Debug to make sure we found the elements
    //console.log("Found indicators:", !!arcagi1Indicator, !!arcagi2Indicator);
    
    // Add hover event listeners
    if (arcagi1Indicator) {
      d3.select(arcagi1Indicator)
        .style("cursor", "pointer")
        .on("mouseenter", () => {
          console.log("V1 hover entered");
          highlightVersion("v1");
        })
        .on("mouseleave", () => {
          console.log("V1 hover left");
          highlightVersion(null);
        });
    } else {
      console.error("Could not find ARC-AGI-1 indicator element");
    }
    
    if (arcagi2Indicator) {
      d3.select(arcagi2Indicator)
        .style("cursor", "pointer")
        .on("mouseenter", () => {
          console.log("V2 hover entered");
          highlightVersion("v2");
        })
        .on("mouseleave", () => {
          console.log("V2 hover left");
          highlightVersion(null);
        });
    } else {
      console.error("Could not find ARC-AGI-2 indicator element");
    }
  }

  /***************************************************************************
   * HIGHLIGHT VERSION
   * Controls visibility and styling of data points based on version focus
   ***************************************************************************/
  function highlightVersion(version) {
    console.log("Highlighting version:", version); // Debugging
    focusedVersion = version;
    
    // Handle all dots (circles and triangles)
    svg.selectAll(".dot")
      .transition()
      .duration(200)
      .attr("opacity", d => {
        if (!focusedVersion) return 1; // No focus, show everything
        const isV1 = d.evaluation_type.startsWith("v1_");
        return (focusedVersion === "v1" && isV1) || (focusedVersion === "v2" && !isV1) ? 1 : 0.2;
      })
      .attr("fill", d => getCircleFillColor(d, focusedVersion))
      .attr("stroke", "none")
      .attr("stroke-width", 0);
    
    // Handle V1 labels
    svg.selectAll(".v1-label")
      .transition()
      .duration(200)
      .attr("opacity", focusedVersion === "v2" ? 0.2 : 1)
      .attr("fill", d => getCircleFillColor(d, focusedVersion));
    
    // Handle V2 labels - key part that needs fixing
    svg.selectAll(".v2-label")
      .transition()
      .duration(200)
      .attr("opacity", d => {
        // Force this calculation to run in case it's not working
        const showLabel = config.showLabelMapping[d.evaluation_type];
        
        if (focusedVersion === "v2") {
          console.log("V2 focused, showing V2 labels"); // Debug
          return 1; // Always show when v2 is focused
        } else if (focusedVersion === "v1") {
          return 0.2; // Fade when v1 is focused
        } else {
          // When no focus, use config
          return showLabel ? 1 : 0;
        }
      })
      .attr("fill", d => getCircleFillColor(d, focusedVersion));
    
    // Handle model group lines
    svg.selectAll(".model-group-line")
      .transition()
      .duration(200)
      .attr("opacity", function() {
        if (!focusedVersion) return 0.8; // Default opacity
        // Get the class name to determine if this is a v1 or v2 line
        const className = d3.select(this).attr("class");
        const isV1Line = !className.includes("v2_");
        return (focusedVersion === "v1" && isV1Line) || (focusedVersion === "v2" && !isV1Line) ? 0.8 : 0.2;
      });

    // Fix grid lines - ensure they remain light
    svg.selectAll(".grid line")
      .attr("stroke", "#333")
      .attr("stroke-opacity", 0.3)
      .attr("shape-rendering", "crispEdges");
  }

  /***************************************************************************
   * INITIALIZE THE CHART (first render)
   ***************************************************************************/
  updateChart();
  // setupVersionHighlights(); // Call the new function to set up hover events

  container.classed("leaderboard-chart", true);
}