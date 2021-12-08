async function drawScatter() {

  // 1. Access data

  const dataset = await d3.json("../../resources/nyc_weather_data.json");
  console.table(dataset[0]);

  // set data constants
  const xAccessor = d => d.temperatureMin;
  const yAccessor = d => d.temperatureMax;

  const colorScaleYear = 2000;  // Force to be the same year. Forget about leap year issues.
  const parseDate = d3.timeParse("%Y-%m-%d");
  const colorAccessor = d => parseDate(d.date).setYear(colorScaleYear);

  // 2. Create chart dimensions

  const width = d3.min([
    window.innerWidth * 0.85,
    window.innerHeight * 0.85,
  ]);
  const dimensions = {
    width: width,
    height: width,
    margin: {
      top: 90,
      right: 90,
      bottom: 50,
      left: 50,
    },
    boundedWidth: 0,
    boundedHeight: 0,
    histogramMargin: 10,
    histogramHeight: 70,
    legendWidth: 250,
    legendHeight: 26,
  };
  dimensions.boundedWidth = dimensions.width -
    dimensions.margin.left - dimensions.margin.right;
  dimensions.boundedHeight = dimensions.height -
    dimensions.margin.top - dimensions.margin.bottom;

  // 3. Draw canvas

  const wrapper = d3.select("#wrapper")
    .append("svg")
      .attr("width", dimensions.width)
      .attr("height", dimensions.height);

  const bounds = wrapper.append("g")
    .style(
      "transform",
      `translate(${dimensions.margin.left}px, ${dimensions.margin.top}px)`,
    );

  const boundsBackground = bounds.append("rect")
      .attr("class", "bounds-background")
      .attr("x", 0)
      .attr("width", dimensions.boundedWidth)
      .attr("y", 0)
      .attr("height", dimensions.boundedHeight);

  // 4. Create scales

  /**
   * Combine temp max and min into a single array and get the extent there.
   * Otherwise our X and Y domains will be different. For the sake of max/min
   * comparisons we should have the same 0 and max on both. That makes our
   * chart's aspect ratio a proper 1:1, so a 45° slope is the equal point.
   */
  const temperatureExtent = d3.extent([
    ...dataset.map(xAccessor),
    ...dataset.map(yAccessor),
  ]);

  const xScale = d3.scaleLinear()
    .domain(temperatureExtent)
    .range([0, dimensions.boundedWidth])
    .nice();

  const yScale = d3.scaleLinear()
    .domain(temperatureExtent)
    .range([dimensions.boundedHeight, 0])
    .nice();

  // Default rainbow style.
  // const colorScale = d3.scaleSequential()
  //   .domain([
  //     parseDate("2000-01-01"),
  //     parseDate("2000-12-31"),
  //   ])
  //   .interpolator(d => d3.interpolateRainbow(-d));  // Inverted rainbow.

  /**
   * My own season-coloring style.
   * It's seriously limited because it must loop with the first and last day
   * of the year being the same. I didn't like putting the peaks of the seasons
   * on the solstices and equinoxes, so I vaguely put them half way through.
   * Seems about right, huh? Feb 15 being the dead of winter, April 30 being
   * the heart of spring, August 1 being the peak of summer, and November 11
   * being the depth of fall.
   * I then used an online tool to get me the middle point in the gradient
   * between Fall and Winter and named it "New Years".
   */
  const colorScale = d3.scaleLinear()
    .domain([
      parseDate(`${colorScaleYear}-01-01`),  // New Years
      parseDate(`${colorScaleYear}-02-15`),  // Winter
      parseDate(`${colorScaleYear}-04-30`),  // Spring
      parseDate(`${colorScaleYear}-08-01`),  // Summer
      parseDate(`${colorScaleYear}-11-02`),  // Fall
      parseDate(`${colorScaleYear}-12-31`),  // New Years
    ])
    .range([
      "#a47146",  // New Years
      "#483d8b",  // Winter
      "#00ff7f",  // Spring
      "#ff0",     // Summer
      "#ffa500",  // Fall
      "#a47146",  // New Years
    ]);

  // 5. Draw data

  const dotsGroup = bounds.append("g");
  const dots = dotsGroup.selectAll(".dot")
    .data(dataset, d => d[0])
    .join("circle")
      .attr("class", "dot")
      .attr("cx", d => xScale(xAccessor(d)))
      .attr("cy", d => yScale(yAccessor(d)))
      .attr("r", 4)
      .style("fill", d => colorScale(colorAccessor(d)))
      .style("stroke", "black")
      .style("stroke-opacity", "0.2");

  // Top Histogram
  const topHistogramGenerator = d3.bin()
    .domain(xScale.domain())
    .value(xAccessor)
    .thresholds(20);

  const topHistogramBins = topHistogramGenerator(dataset);

  // Yes, we're creating a scale here and not up where the other scales are.
  const topHistogramYScale = d3.scaleLinear()
    .domain(d3.extent(topHistogramBins, d => d.length))
    .range([dimensions.histogramHeight, 0]);  // Y axis, so, [70, 0].

  const topHistogramBounds = bounds.append("g")
      .attr("transform", `translate(0, ${
        -dimensions.histogramHeight - dimensions.histogramMargin
      })`); // Move it up to the area at the top we want to use.

  /**
   * We use d3.area() because d3.line() doesn't have a bottom (unless we make
   * it, see what we did in the radar chart in ch 8). But that means that if
   * the Y axis of the first and last point are different you'll get a horrible
   * slicing effect.
   * Here we're giving the datum from the bins and using the bin's x0 and x1
   * positions in the xScale and finding the middle point between the two to be
   * our x. y0() is our floor (always the height, in this case). y1() is the
   * height of the datum we want to render.
   */
  const topHistogramLineGenerator = d3.area()
    .x(d => xScale((d.x0 + d.x1) / 2))
    .y0(dimensions.histogramHeight)
    .y1(d => topHistogramYScale(d.length))
    .curve(d3.curveBasis);

  const topHistogramElement = topHistogramBounds.append("path")
      .attr("d", _ => topHistogramLineGenerator(topHistogramBins))
      .attr("class", "histogram-area");

  // Right Historgram
  const rightHistorgramGenerator = d3.bin()
    .domain(yScale.domain())
    .value(yAccessor)
    .thresholds(20);

  const rightHistogramBins = rightHistorgramGenerator(dataset);

  const rightHistogramYScale = d3.scaleLinear()
    .domain(d3.extent(rightHistogramBins, d => d.length))
    .range([dimensions.histogramHeight, 0]);

  const rightHistogramBounds = bounds.append("g")
    .style("transform-origin", `0 ${dimensions.histogramHeight}px`)
    .style("transform", `translate(${
      dimensions.boundedWidth + dimensions.histogramMargin
    }px, -${
      dimensions.histogramHeight
    }px) rotate(90deg)`); // We're rotating the whole thing!

  const rightHistogramLineGenerator = d3.area()
    .x(d => yScale((d.x0 + d.x1) / 2))
    .y0(dimensions.histogramHeight)
    .y1(d => rightHistogramYScale(d.length))
    .curve(d3.curveBasis);

  const rightHistogramElement = rightHistogramBounds.append("path")
    .attr("d", _ => rightHistogramLineGenerator(rightHistogramBins))
    .attr("class", "histogram-area");

  // 6. Draw peripherals

  const xAxisGenerator = d3.axisBottom()
    .scale(xScale)
    .ticks(4);

  const xAxis = bounds.append("g")
    .call(xAxisGenerator)
      .style("transform", `translateY(${dimensions.boundedHeight}px)`);

  const xAxisLabel = xAxis.append("text")
      .attr("class", "x-axis-label")
      .attr("x", dimensions.boundedWidth / 2)
      .attr("y", dimensions.margin.bottom - 10)
      .html("Minimum Temperature (&deg;F)");

  const yAxisGenerator = d3.axisLeft()
    .scale(yScale)
    .ticks(4);

  const yAxis = bounds.append("g")
      .call(yAxisGenerator);

  const yAxisLabel = yAxis.append("text")
      .attr("class", "y-axis-label")
      .attr("x", -dimensions.boundedHeight / 2)
      .attr("y", -dimensions.margin.left + 10)
      .html("Maximum Temperature (&deg;F)");

  /**
   * Creating the color gradient legend.
   * Something weird I realized. If you define your transform as a .style() you
   * need to use px values. But if its an attribute you just write the numbers.
   * Adding px to the transform below will break it.
   */
  const legendGroup = bounds.append("g")
      .attr("transform", `translate(${
        dimensions.boundedWidth - dimensions.legendWidth - 9
      }, ${
        dimensions.boundedHeight - 37
      })`);
  const defs = wrapper.append("defs");
  const numberOfGradientStops = 10;
  const stops = d3.range(numberOfGradientStops).map(
    i => (i / (numberOfGradientStops - 1)),
  );
  const legendGradientId = "legend-gradient";
  const gradient = defs.append("linearGradient")
      .attr("id", legendGradientId)
    .selectAll("stop")
    .data(stops)
    .join("stop")
      // .attr("stop-color", d => d3.interpolateRainbow(-d))
      .attr("stop-color", d => colorScale(
        colorAccessor({ date: fractionOfYear(d) }), // Yes. This is ridiculous.
      ))
      .attr("offset", d => `${d * 100}%`);
  const legendGradient = legendGroup.append("rect")
      .attr("height", dimensions.legendHeight)
      .attr("width", dimensions.legendWidth)
      .style("fill", `url(#${legendGradientId})`);

  // 7. Set up interactions
  const delaunay = d3.Delaunay.from(
    dataset,
    d => xScale(xAccessor(d)),
    d => yScale(yAccessor(d)),
  );
  const voronoiPolygons = delaunay.voronoi();
  voronoiPolygons.xmax = dimensions.boundedWidth;
  voronoiPolygons.ymax = dimensions.boundedHeight;

  const voronoi = dotsGroup.selectAll(".voronoi")
    .data(dataset)
      .join("path")
      .attr("class", "voronoi")
      // .attr("stroke", "grey")
      .attr("d", (_d, i) => voronoiPolygons.renderCell(i));

  voronoi.on("mouseenter", onVoronoiMouseEnter)
    .on("mouseleave", onVoronoiMouseLeave);

  const tooltip = d3.select("#tooltip");
  const hoverElementsGroup = bounds.append("g")
    .attr("opacity", 0);

  const dayDot = hoverElementsGroup.append("circle")
      .attr("class", "tooltip-dot");

  const horizontalLine = hoverElementsGroup.append("rect")
      .attr("class", "hover-line");
  const verticalLine = hoverElementsGroup.append("rect")
      .attr("class", "hover-line");

  function onVoronoiMouseEnter(_e, datum) {
    hoverElementsGroup.style("opacity", 1);

    const x = xScale(xAccessor(datum));
    const y = yScale(yAccessor(datum));
    dayDot.attr("cx", _d => x)
        .attr("cy", _d => y)
        .attr("r", 7);

    const hoverLineThickness = 10;
    horizontalLine.attr("x", x)
      .attr("y", y - hoverLineThickness / 2)
      .attr("width", dimensions.boundedWidth
        + dimensions.histogramMargin
        + dimensions.histogramHeight
        - x)
      .attr("height", hoverLineThickness);
    verticalLine.attr("x", x - hoverLineThickness / 2)
      .attr("y", -dimensions.histogramMargin - dimensions.histogramHeight)
      .attr("width", hoverLineThickness)
      .attr("height", y
        + dimensions.histogramMargin
        + dimensions.histogramHeight);

    const formatTemperature = d3.format(".1f");
    tooltip.select("#max-temperature")
      .text(formatTemperature(yAccessor(datum)));
    tooltip.select("#min-temperature")
      .text(formatTemperature(xAccessor(datum)));

    const dateParser = d3.timeParse("%Y-%m-%d");
    const formatDate = d3.timeFormat("%A, %B %-d, %Y");
    tooltip.select("#date").text(formatDate(dateParser(datum.date)));

    tooltip.style("transform", "translate("
      + `calc(${x + dimensions.margin.left}px + -50%),`
      + `calc(${y + dimensions.margin.top - 4}px + -100%)`);

    tooltip.style("opacity", 1);
  }

  function onVoronoiMouseLeave() {
    hoverElementsGroup.style("opacity", 0);
    tooltip.style("opacity", 0);
  }

  /**
   * Uses local time because UTC isn't necessary.
   * @param {*} decimal The 0->1 fraction for stops, will return dates.
   * @returns
   */
  function fractionOfYear(decimal) {
    // Yes, January is month 0.
    const startEpoch = new Date(colorScaleYear, 0, 1) / 1000;
    const secondsInYear = 365 * 24 * 60 * 60;

    const resultDate = new Date(0).setSeconds((startEpoch + secondsInYear * decimal));
    const resultDateString = d3.timeFormat("%Y-%m-%d")(resultDate);
    console.log(decimal, resultDateString, (startEpoch + secondsInYear * decimal));
    return resultDateString;
  }
}
drawScatter();

