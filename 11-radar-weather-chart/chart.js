async function drawChart() {

  const TEMPERATURE_TICKS = 4;
  const UV_INDEX_THRESHOLD = 8;

  // 1. Access data

  let dataset = await d3.json("../../resources/nyc_weather_data.json");
  console.table(dataset[0]);

  const dateParser = d3.timeParse("%Y-%m-%d");

  const temperatureMinAccessor = d => d.temperatureMin;
  const temperatureMaxAccessor = d => d.temperatureMax;
  const uvAccessor = d => d.uvIndex;
  const precipitationProbabilityAccessor = d => d.precipProbability;
  const precipitationTypeAccessor = d => d.precipType;
  const cloudAccessor = d => d.cloudCover;
  const dateAccessor = d => dateParser(d.date);

  // 2. Create chart dimensions

  const width = 600;
  const dimensions = {
    width: width,
    height: width,
    radius: width / 2,
    margin: {
      top: 120,
      right: 120,
      bottom: 120,
      left: 120,
    },
    boundedHeight: 0,
    boundedWidth: 0,
    boundedRadius: 0,
  };
  dimensions.boundedWidth = dimensions.width
    - dimensions.margin.left - dimensions.margin.right;
  dimensions.boundedHeight = dimensions.height
    - dimensions.margin.top - dimensions.margin.bottom;
  dimensions.boundedRadius = dimensions.radius
    - ((dimensions.margin.left + dimensions.margin.right) / 2);

  // 3. Draw canvas

  const wrapper = d3.select("#wrapper")
    .append("svg")
      .attr("width", dimensions.width)
      .attr("height", dimensions.height);


  /**
   * We make a conscious decision to move the bounds of our chart to the center
   * so that we don't have to shift everything by [boundedRadius, boundedRadius]
   * all the time.
   */
  const bounds = wrapper.append("g")
      .style(
        "transform",
        `translate(${
          dimensions.margin.left + dimensions.boundedRadius
        }px, ${
          dimensions.margin.top + dimensions.boundedRadius
        }px)`,
      );

  // Creating gradients.
  const defs = wrapper.append("defs");

  const gradientId = "temperature-gradient";
  const gradient = defs.append("radialGradient")
      .attr("id", gradientId);
  const numberOfStops = 10;
  const gradientColorScale = d3.interpolateYlOrRd;
  d3.range(numberOfStops).forEach(i => {
    gradient.append("stop")
        .attr("offset", `${i * 100 / (numberOfStops - 1)}%`)
        .attr("stop-color", gradientColorScale(i / (numberOfStops - 1)));
  });

  // 4. Create scales

  const angleScale = d3.scaleTime()
    .domain(d3.extent(dataset, dateAccessor))
    .range([0, Math.PI * 2]); // In radians.

  const radiusScale = d3.scaleLinear()
    .domain(d3.extent([ // Min and Max temps - for a full range.
      ...dataset.map(temperatureMaxAccessor),
      ...dataset.map(temperatureMinAccessor),
    ]))
    .range([0, dimensions.boundedRadius])
    .nice();

  // Using the square root scale to correctly size a two dimensional chart.
  const cloudRadiusScale = d3.scaleSqrt()
    .domain(d3.extent(dataset, cloudAccessor))
    .range([1, 10]);

  const precipitationRadiusScale = d3.scaleSqrt()
    .domain(d3.extent(dataset, precipitationProbabilityAccessor))
    .range([1, 8]);
  const precipitationTypes = ["rain", "sleet", "snow"];
  const precipitationTypeColorScale = d3.scaleOrdinal()
    .domain(precipitationTypes)
    .range(["#54a0ff", "#636e72", "#b2bec3"]);

  const temperatureColorScale = d3.scaleSequential()
    .domain(d3.extent([
      ...dataset.map(temperatureMinAccessor),
      ...dataset.map(temperatureMaxAccessor),
    ]))
    .interpolator(gradientColorScale);

  // 5. Draw peripherals
  const peripherals = bounds.append("g");

  // How to get a range of months from the domain we're using.
  // const months = d3.timeMonth.range(...angleScale.domain()); // Long version.
  const months = d3.timeMonths(...angleScale.domain()); // Shortcut version.

  /**
   * Draw the month spokes.
   * Not sure how to fix it but the chart's spokes are not exactly straight.
   * There is a tiny rotation in all spokes, even the ones facing in a cardinal
   * direction. I tried using utcParse in my date accessor but it doesn't seem
   * to work.
   */
  months.forEach(month => {
    const angle = angleScale(month);
    const [x, y] = getCoordinatesForAngle(angle);

    peripherals.append("line") // x1 and y1 default to 0. Which we need.
        .attr("x2", x)
        .attr("y2", y)
        .attr("class", "grid-line");

    const [labelX, labelY] = getCoordinatesForAngle(angle, 1.38);
    peripherals.append("text")
        .attr("x", labelX)
        .attr("y", labelY)
        .attr("class", "tick-label")
        .text(d3.timeFormat("%b")(month))
        .style("text-anchor",
          Math.abs(labelX) < 5 ? "middle" : // Within 5 pixels of vertical.
            labelX > 0 ? "start" :  // To the right.
              "end",                // Else (to the left).
        );
  });

  const temperatureTicks = radiusScale.ticks(TEMPERATURE_TICKS);
  const gridCircles = temperatureTicks.map(d => (
    peripherals.append("circle")
        .attr("r", radiusScale(d))
        .attr("class", "grid-line")
  ));

  const tickLabelBackgrounds = temperatureTicks.map(d => {
    if (!d) return;
    return peripherals.append("rect")
        .attr("y", -radiusScale(d) - 10)
        .attr("width", 40)
        .attr("height", 20)
        .attr("class", "tick-label-background");
  });

  const tickLabels = temperatureTicks.map(d => {
    if (!d) return;
    return peripherals.append("text")
        .attr("x", 4)
        .attr("y", -radiusScale(d) + 2)
        .attr("class", "tick-label-temperature")
        .html(`${d3.format(".0f")(d)}??F`);
  });

  const containsFreezing = radiusScale.domain()[0] < 32;
  if (containsFreezing) {
    const freezingCircle = bounds.append("circle")
        .attr("r", radiusScale(32))
        .attr("class", "freezing-circle");
  }


  // 6. Draw data
  /**
   * Adding the temperature area around the center of the chart is surprisingly
   * simple. The gradient color, though, is a bit involved. Look above to see
   * how it's defined.
   */
  const areaGenerator = d3.areaRadial()
      .angle(d => angleScale(dateAccessor(d)))
      .innerRadius(d => radiusScale(temperatureMinAccessor(d)))
      .outerRadius(d => radiusScale(temperatureMaxAccessor(d)));

  const area = bounds.append("path")
      .attr("class", "area")
      .attr("d", areaGenerator(dataset))
      .style("fill", `url(#${gradientId})`);

  /**
   * This is also pleasantly easy to accomplish. With some foresight into
   * writing good utility functions and leveraging our scales and accessors
   * things really come together quite easily.
   */
  const uvGroup = bounds.append("g");
  const uvOffset = 0.95;
  const highUvDays = uvGroup.selectAll("line")
    .data(dataset.filter(d => uvAccessor(d) > UV_INDEX_THRESHOLD))
    .join("line")
      .attr("class", "uv-line")
      .attr("x1", d => getXFromDataPoint(d, uvOffset))
      .attr("x2", d => getXFromDataPoint(d, uvOffset + 0.1))
      .attr("y1", d => getYFromDataPoint(d, uvOffset))
      .attr("y2", d => getYFromDataPoint(d, uvOffset + 0.1));

  // Cloud cover
  const cloudGroup = bounds.append("g");
  const cloudOffset = 1.27;
  const cloudDots = cloudGroup.selectAll("circle")
    .data(dataset)
    .join("circle")
      .attr("class", "cloud-dot")
      .attr("cx", d => getXFromDataPoint(d, cloudOffset))
      .attr("cy", d => getYFromDataPoint(d, cloudOffset))
      .attr("r", d => cloudRadiusScale(cloudAccessor(d)));


  // Precipitation indicators
  const precipitationGroup = bounds.append("g");
  const precipitationOffset = 1.14;
  const precipitationDots = precipitationGroup.selectAll("circle")
    .data(dataset.filter(precipitationTypeAccessor))
    .join("circle")
      .attr("class", "precipitation-dot")
      .attr("cx", d => getXFromDataPoint(d, precipitationOffset))
      .attr("cy", d => getYFromDataPoint(d, precipitationOffset))
      .attr("r", d => precipitationRadiusScale(
        precipitationProbabilityAccessor(d),
      ))
      .style("fill", d => precipitationTypeColorScale(
        precipitationTypeAccessor(d),
      ));

  // Annotations!
  const annotationGroup = bounds.append("g"); // Add this now so they're on top.
  drawAnnotation(Math.PI * 0.23, cloudOffset, "Cloud Cover");
  drawAnnotation(Math.PI * 0.26, precipitationOffset, "Precipitation");
  drawAnnotation(Math.PI * 0.7, 0.5, "Temperature");
  drawAnnotation(Math.PI * 0.734, uvOffset + 0.1, `UV Index over ${UV_INDEX_THRESHOLD}`);
  if (containsFreezing) {
    drawAnnotation(
      Math.PI * 0.768,
      radiusScale(32) / dimensions.boundedRadius, // px/px = offset ratio.
      "Freezing Temperatures",
    );
  }
  precipitationTypes.forEach((precipitationType, index) => {
    const [x, y] = getCoordinatesForAngle(Math.PI * 0.26, 1.6);
    annotationGroup.append("circle")
        .attr("cx", x + 15)
        .attr("cy", y + (16 * (index + 1)))
        .attr("r", 4)
        .style("opacity", 0.7)
        .attr("fill", precipitationTypeColorScale(precipitationType));
    annotationGroup.append("text")
        .attr("class", "annotation-text")
        .attr("x", x + 25)
        .attr("y", y + (16 * (index + 1)))
        .text(precipitationType);
  });

  // 7. Set up interactions
  const listenerCircle = bounds.append("circle")
    .attr("class", "listener-circle")
    .attr("r", dimensions.width/2)
    .on("mousemove", onMouseMove)
    .on("mouseleave", onMouseLeave);

  const tooltip = d3.select("#tooltip");
  const tooltipLine = bounds.append("path")
    .attr("class", "tooltip-line");

  function onMouseMove(e) {
    const [x, y] = d3.pointer(e);
    let angle = getAngleFromCoordinates(x, y) + Math.PI / 2;

    /**
     * To keep our angles positive, we'll want to rotate any negative angles
     * around our circle by one full turn, so they fit on our angleScale.
     */
    if (angle < 0) angle = (Math.PI * 2) + angle;

    const tooltipArcGenerator = d3.arc()
      .innerRadius(0)
      .outerRadius(dimensions.boundedRadius * 1.6)
      .startAngle(angle - 0.015)
      .endAngle(angle + 0.015);

    tooltipLine.attr("d", tooltipArcGenerator())
        .style("opacity", 1);

    // "o" for "outer".
    const [oX, oY] = getCoordinatesForAngle(angle, 1.6);
    /**
     * Do some slick re-positioning based on the position we are around the
     * circle. There's some real mental gymnastics required with combining, with
     * calc(), px and % values. Then, it's doubly strange when you got to deal
     * with Y coordinates being backwards (from the top left corner being the
     * origin in our browsers).
     */
    tooltip.style("opacity", 1)
      .style("transform", `translate(calc(${
        oX < -50 ? "40px - 100" : // To the left? Set X 40px left of right edge
          oX > 50 ? "-40px + 0" : // To the right? Set X 40px right of left edge
            "-50" // Center
      }% + ${
        oX + dimensions.margin.top + dimensions.boundedRadius
      }px), calc(${
        oY < -50 ? "40px - 100" : // Up? Set Y 40px higher from bottom edge
          oY > 50 ? "-40px + 0" : // Down? Set Y 40px lower from top edge
            "-50" // Center
      }% + ${
        oY + dimensions.margin.top + dimensions.boundedRadius
      }px))`);

    // Hey, it's our friend invert()! Doing great work as always, buddy!
    const date = angleScale.invert(angle);
    const dateString = d3.timeFormat("%Y-%m-%d")(date);
    const dataPoint = dataset.filter(d => d.date === dateString)[0];

    if (!dataPoint) return; // Just in case we mess up.

    // Populate the elements in the tooltip.
    tooltip.select("#tooltip-date")
        .text(d3.timeFormat("%B %-d")(date));
    tooltip.select("#tooltip-temperature-min")
        .style("color", temperatureColorScale(
          temperatureMinAccessor(dataPoint),
        ))
        .html(`${d3.format(".1f")(temperatureMinAccessor(dataPoint))}??F`);
    tooltip.select("#tooltip-temperature-max")
        .style("color", temperatureColorScale(
          temperatureMaxAccessor(dataPoint),
        ))
        .html(`${d3.format(".1f")(temperatureMaxAccessor(dataPoint))}??F`);
    tooltip.select("#tooltip-uv")
        .text(uvAccessor(dataPoint));
    tooltip.select("#tooltip-cloud")
        .text(cloudAccessor(dataPoint));
    tooltip.select("#tooltip-precipitation")
        .text(d3.format(".0%")(precipitationProbabilityAccessor(dataPoint)));
    tooltip.select("#tooltip-precipitation-type")
        .text(precipitationTypeAccessor(dataPoint));
    tooltip.select(".tooltip-precipitation-type")
        .style("color", precipitationTypeAccessor(dataPoint)
          ? precipitationTypeColorScale(precipitationTypeAccessor(dataPoint))
          : "#dadadd");
  }

  function onMouseLeave() {
    tooltipLine.style("opacity", 0);
    tooltip.style("opacity", 0);

  }

  // Helper functions

  /**
   * Get the x, y coordinates of any angle you place in here, rotated to the
   * left 90?? (in the 12 o'clock position). You can provide an offset to extend
   * or shorten any desired coordinate.
   * @param {number} angle radians
   * @param {number} offset multiplier of the distance from the center
   * @returns
   */
  function getCoordinatesForAngle(angle, offset = 1) {
    return [
      Math.cos(angle - Math.PI / 2) * dimensions.boundedRadius * offset,
      Math.sin(angle - Math.PI / 2) * dimensions.boundedRadius * offset,
    ];
  }

  function getCoordinatesFromDataPoint(d, offset) {
    return getCoordinatesForAngle(
      angleScale(dateAccessor(d)),
      offset,
    );
  }
  function getXFromDataPoint(d, offset = 1.4) {
    return getCoordinatesFromDataPoint(d, offset)[0];
  }
  function getYFromDataPoint (d, offset = 1.4) {
    return getCoordinatesFromDataPoint(d, offset)[1];
  }

  function getAngleFromCoordinates(x, y) {
    return Math.atan2(y, x); // Yes, y and x are flipped.
  }

  function drawAnnotation(angle, offset, text) {
    // Create two sets of coordinates. From a start offset to a result offset.
    const [x1, y1] = getCoordinatesForAngle(angle, offset);
    const [x2, y2] = getCoordinatesForAngle(angle, 1.6);

    annotationGroup.append("line")
      .attr("class", "annotation-line")
      .attr("x1", x1)
      .attr("x2", x2)
      .attr("y1", y1)
      .attr("y2", y2);

    annotationGroup.append("text")
      .attr("class", "annotation-text")
      .attr("x", x2 + 6)
      .attr("y", y2)
      .text(text);
  }
}
drawChart();
