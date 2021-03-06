async function drawBars() {
  // # Access data
  let dataset = await d3.json("../resources/nyc_weather_data.json");

  // # Create dimensions
  const width = 600;

  let dimensions = {
    width: width,
    height: width * 0.6,
    margin: {
      top: 30,
      right: 10,
      bottom: 50,
      left: 50,
    },
    boundedWidth: 0,
    boundedHeight: 0,
  };
  dimensions.boundedWidth = dimensions.width - dimensions.margin.left - dimensions.margin.right;
  dimensions.boundedHeight = dimensions.height - dimensions.margin.top - dimensions.margin.bottom;

  const drawHistogram = (metric) => {
    // # Define accessors
    const metricAccessor = d => d[metric];
    const yAccessor = d => d.length;

    // # Draw canvas
    const wrapper = d3.select("#wrapper")
      .append("svg")
      .attr("width", dimensions.width)
      .attr("height", dimensions.height)
      .attr("role", "figure") // Accessibility additions
      .attr("tabindex", "0"); // "0" or "-1" only.

    const title = wrapper.append("title") // Accessibility addition.
      .text(`Histogram looking at the distribution of ${metric} in one year`);

    const bounds = wrapper.append("g")
      .style("transform", `translate(${
        dimensions.margin.left
      }px, ${
        dimensions.margin.top
      }px)`);

    // # Create scales
    const xScale = d3.scaleLinear()
      .domain(d3.extent(dataset, metricAccessor))
      .range([0, dimensions.boundedWidth])
      .nice();

    // # Create bins
    const binsGenerator = d3.bin()
      .domain(xScale.domain())
      .value(metricAccessor)
      .thresholds(12);  // 13 bins in total. d3 decides on final results. Use array to define directly.

    // This is a new set of data that we can manipulate.
    const bins = binsGenerator(dataset);

    // Take a look at the results. x0 is the lower bound. x1 is the upper bound (not including).
    console.log(bins);

    // # Creating the y scale
    const yScale = d3.scaleLinear()
      .domain([0, d3.max(bins, yAccessor)]) // Not extent() because we want to start at 0!
      .range([dimensions.boundedHeight, 0])
      .nice();

    // # Draw data
    // binsGroup is a <g> to hold all bins.
    const binsGroup = bounds.append("g")
      .data(bins)
      .attr("tabindex", "0")  // Accessibility addition.
      .attr("role", "list")
      .attr("aria-label", "histogram bars");

    // Will create a new <g> for each bin. Each will be given a <g>.
    const binGroups = binsGroup.selectAll("g")  // Only one (we JUST appended it).
      .data(bins)
      // .join("g")  // Join function is like the one for an array to make a string!
      .enter().append("g")  // Accessibility addition.
      .attr("tabindex", "0")
      .attr("role", "listitem")
      .attr("aria-label", d => `There were ${
        yAccessor(d)
      } days between ${
        d.x0.toString().slice(0, 4)
      } and ${
        d.x1.toString().slice(0, 4)
      } ${metric} levels.`);


    const barPadding = 1;

    const barRects = binGroups.append("rect") // rect needs x, y, width, height
      .attr("x", d => xScale(d.x0) + barPadding / 2)  // How far horizontal
      .attr("y", d => yScale(yAccessor(d)))           // How far vertical
      .attr("width", d => d3.max([                    // How wide
        0,  // Pass 0 just in case we calculate a negative number!
        xScale(d.x1) - xScale(d.x0) - barPadding, // Heavy use of scale here!
      ]))
      .attr("height", d => dimensions.boundedHeight - yScale(yAccessor(d)))
      .attr("fill", "cornflowerblue");

    // # Adding labels
    const barText = binGroups.filter(yAccessor) // Filter falsy values (0 length).
      .append("text")
      .attr("x", d => xScale(d.x0) + (xScale(d.x1) - xScale(d.x0)) / 2) // Center
      .attr("y", d => yScale(yAccessor(d)) - 5) // 5px higher
      .text(yAccessor)  // The bin length
      .style("text-anchor", "middle") // Center align text by making anchor in middle.
      .attr("fill", "darkgrey")
      .style("font-size", "12px")
      .style("font-family", "sans-serif");

    // # Extra credit
    const mean = d3.mean(dataset, metricAccessor);
    const meanLine = bounds.append("line")
      .attr("x1", xScale(mean))
      .attr("y1", -15)
      .attr("x2", xScale(mean))
      .attr("y2", dimensions.boundedHeight)
      .attr("stroke", "maroon")
      .attr("stroke-dasharray", "2px 4px");

    const meanLabel = bounds.append("text")
      .attr("x", xScale(mean))
      .attr("y", -20)
      .text("mean")
      .attr("fill", "maroon")
      .style("text-anchor", "middle")
      .style("font-size", "12px");

    // # Draw peripherals
    const xAxisGenerator = d3.axisBottom()
      .scale(xScale);

    const xAxis = bounds.append("g")
      .call(xAxisGenerator)
      .style("transform", `translateY(${dimensions.boundedHeight}px)`);

    const xAxisLabel = xAxis.append("text")
      .attr("x", dimensions.boundedWidth / 2)
      .attr("y", dimensions.margin.bottom - 10)
      .attr("fill", "black")
      .style("font-size", "12px")
      .text(metric)
      .style("text-transform", "capitalize");
  };

  const metrics = [
    "windSpeed",
    "moonPhase",
    "dewPoint",
    "humidity",
    "uvIndex",
    "windBearing",
    "temperatureMin",
    "temperatureMax",
  ];

  metrics.forEach(drawHistogram);

  // Accessibility addition. This silences readers from speaking out plain text.
  // I suspect you could do stuff like class naming to specify this selectAll().
  wrapper.selectAll("text")
    .attr("role", "presentation")
    .attr("aria-hidden", "true");
}
drawBars();
