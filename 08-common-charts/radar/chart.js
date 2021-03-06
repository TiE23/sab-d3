async function drawBars() {

  const GRID_TICKS = 5;

  // 1. Access data

  let dataset = await d3.json("../../resources/nyc_weather_data.json");

  const dateParser = d3.timeParse("%Y-%m-%d");
  const dateAccessor = d => dateParser(d.date);
  dataset = dataset.sort((a,b) => dateAccessor(a) - dateAccessor(b));
  const metrics = [
    "windBearing",
    "moonPhase",
    "pressure",
    "humidity",
    "windSpeed",
    "temperatureMax",
  ];

  // 2. Create chart dimensions

  const width = 600;
  let dimensions = {
    width: width,
    height: width,
    radius: width / 2,
    margin: {
      top: 80,
      right: 80,
      bottom: 80,
      left: 80,
    },
    boundedWidth: 0,
    boundedHeight: 0,
    boundedRadius: 0,
  };
  dimensions.boundedWidth = dimensions.width - dimensions.margin.left - dimensions.margin.right;
  dimensions.boundedHeight = dimensions.height - dimensions.margin.top - dimensions.margin.bottom;
  dimensions.boundedRadius = dimensions.radius - ((dimensions.margin.left + dimensions.margin.right) / 2);

  // 3. Draw canvas

  const wrapper = d3.select("#wrapper")
    .append("svg")
      .attr("width", dimensions.width)
      .attr("height", dimensions.height);

  const bounds = wrapper.append("g")
      .style("transform", `translate(${dimensions.margin.left}px, ${dimensions.margin.top}px)`);

  // 4. Create scales

  const metricScales = metrics.map(metric => (
    d3.scaleLinear()
    .domain(d3.extent(dataset, d => +d[metric]))
    .range([0, dimensions.boundedRadius])
    .nice()
  ));

  // 6. Draw peripherals
  // We're drawing our axes early here so they don't overlap our radar line

  const axis = bounds.append("g").attr("class", "web");

  const gridCircles = d3.range(GRID_TICKS + 1).map((_, i) => (
    axis.append("circle")
      .attr("cx", dimensions.boundedRadius)
      .attr("cy", dimensions.boundedRadius)
      .attr("r", dimensions.boundedRadius * (i / (GRID_TICKS)))
      .attr("class", "grid-line")
  ));

  const gridLines = metrics.map((_metric, i) => {
    /**
     * You should take a quick refresher of what a radian IS by looking at the
     * illustration gif here: https://en.wikipedia.org/wiki/Radian
     * A radian is the radius of your circle, its length, marked on the
     * circumference of the circle. You need 2?? worth of your radius to make a
     * full trip around the circumference.
     * We slice our circle into six segments when we do six different values on
     * the radar chart.
     * So, taking 2?? / 6 we're able to split our angle into six slices around
     * a full circle. Multiply by i to get how much of an angle we want.
     * Subtracting 0.5?? rotates the slices by 90?? CCW (you can tell which way
     * it goes by inspecting the 1st, 2nd, ... lines that get drawn). So that
     * instead of the first line being to the right (as is standard form for
     * representing the start of a circle) it points straight up and the
     * remaining line slices rotate around the central point.
     * The first line has a radian of -1.57 - which is negative half pi.
     *      With -0.5??          Without -0.5??
     * -1.5707963267948966    0
     * -0.5235987755982989    1.0471975511965976
     * 0.5235987755982987     2.0943951023931953
     * 1.5707963267948966     3.141592653589793
     * 2.617993877991494      4.1887902047863905
     * 3.6651914291880914     5.235987755982988
     * It works out because i goes from 0 to 5. Meaning we don't reach 2??
     * (6.2831853072).
     */
    const angle = i * ((Math.PI * 2) / metrics.length) - Math.PI * 0.5;

    console.log(
      "i * ((   Math.PI * 2   ) / metrics.length) -   Math.PI * 0.5    =       angle" +
      `\n${i} * ( ${Math.PI * 2}  /      ${metrics.length}        ) - ${Math.PI * 0.5} = ${angle}`,
    );

    return axis.append("line")
      .attr("x1", dimensions.boundedWidth / 2)  // Middle of chart.
      .attr("y1", dimensions.boundedHeight / 2) // Middle of chart.
      /**
       * We're multiplying radius by the angle (a radian value). The radius
       * is our hypotenuse. Given we have the hypotenuse and the angle, we can
       * find the Adjacent or the Opposite.
       * Cosine gets us the Adjacent (x).    Sine gets us the Opposite (y).
       *  COH Cosine -> Opposite/Hypotenuse!   SAH Sine -> Adjacent/Hypotenuse!
       */
      .attr("x2", Math.cos(angle) * dimensions.boundedRadius + dimensions.boundedWidth / 2)
      .attr("y2", Math.sin(angle) * dimensions.boundedRadius + dimensions.boundedWidth / 2)
      .attr("class", "grid-line");
  });

  const labels = metrics.map((metric, i) => {
    const angle = i * ((Math.PI * 2) / metrics.length) - Math.PI * 0.5;
    const x = Math.cos(angle) * (dimensions.boundedRadius * 1.1) + dimensions.boundedWidth / 2;
    const y = Math.sin(angle) * (dimensions.boundedRadius * 1.1) + dimensions.boundedHeight / 2;
    return axis.append("text")
      .attr("x", x)
      .attr("y", y)
      .attr("class", "metric-label")
      .style("text-anchor",
        i == 0 || i == metrics.length / 2 ? "middle" :
          i < metrics.length / 2 ? "start" :
            "end",
      )
      .text(metric);
  });

  // 5. Draw data

  const line = bounds.append("path")
      .attr("class", "line");

  const dotGroupsContainer = bounds.append("g")
    .attr("class", "dot-groups-container");

  const drawLine = (day) => {
    /**
     * This is a cool thing. Here lines are being drawn with d3.lineRadial().
     * Points on the line are being placed using angles are being derived from
     * the index of the metric being read and using its scale to figure out how
     * long the radius should be. Finally, the line is being given a curve that
     * gives it a treatment that closes it (that is, it connects the last point
     * to the first).
     * If you're wondering how the interior is filled out, well, take a look at
     * its CSS rule. fill and fill-opacity are set in styles.css.
     */
    const lineGenerator = d3.lineRadial()
        .angle((_metric, i) => i * ((Math.PI * 2) / metrics.length))
        .radius((metric, i) => metricScales[i](+day[metric] || 0))
        .curve(d3.curveLinearClosed);

    const line = bounds.select(".line")
        .datum(metrics)
        .attr("d", lineGenerator) // lineGenerator is passed datum here.
        .style("transform", // Place the line in the center of the chart.
          `translate(${dimensions.boundedRadius}px, ${dimensions.boundedRadius}px)`,
        );

    // Necessary to detect and update on day changes but still have metrics.
    const daysData = metrics.map((metric, i) => {
      const angle = i * ((Math.PI * 2) / metrics.length) - Math.PI * 0.5;
      const radius = metricScales[i](+day[metric] || 0);
      return {
        metric,
        value: +day[metric] || 0,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      };
    });

    // Basic working single dot.
    // const dots = dotGroupsContainer.selectAll(".dot")
    //   .data(daysData)
    //   .join("circle")
    //     .attr("cx", d => d.x)
    //     .attr("cy", d => d.y)
    //     .attr("r", 4)
    //     .attr("class", "dot")
    //   .style("transform",
    //     `translate(${dimensions.boundedRadius}px, ${dimensions.boundedRadius}px)`,
    //   )
    //   .on("mouseenter", onMouseEnter)
    //   .on("mouseleave", onMouseLeave);

    /**
     * Oh my god this mother trucker took some time to figure out. But I'm glad
     * to say that the solution is understandable. I also learned that D3.js
     * really suggests we all move to using the .join() function instead of
     * using enter(), update(), exit().
     *  See https://observablehq.com/@d3/selection-join
     * I want to thank Bryony Miles for having a great example using SVG groups
     * in both old style merge() updates and with join(). Without her demo I
     * would've given up and believed (lacking any saying otherwise) that this
     * kind of manipulation with .join() isn't possible with SVG groups... and
     * that would have been a horrible false lesson to take away!
     *  See https://www.codementor.io/@milesbryony/d3-js-join-14gqdz3hfj
     */
    const dotGroups = dotGroupsContainer.selectAll(".dot-group")
      .data(daysData)
      .join(
        enter => {
          const group = enter.append("g").attr("class", "dot-group");
          group.append("circle")
            .attr("cx", d => d.x)
            .attr("cy", d => d.y)
            .attr("r", 15)
            .attr("class", "dot-activation");
          group.append("circle")
            .attr("cx", d => d.x)
            .attr("cy", d => d.y)
            .attr("r", 4)
            .attr("class", "dot");
          group.style("transform",
            `translate(${dimensions.boundedRadius}px, ${dimensions.boundedRadius}px)`,
          );
          return group;
        },
        update => {
          update.select(".dot-activation")
          .attr("cx", d => d.x)
          .attr("cy", d => d.y);
          update.select(".dot")
          .attr("cx", d => d.x)
          .attr("cy", d => d.y);
          return update;
        },
        // exit => exit.remove(), // No need - this is default behavior.

        /**
         * This is a failed experiment to translate the group itself and leave
         * the cx and cy values blank. Only problem was the movements were
         * instantaneous. It would still be possible to make this work if I
         * controlled transitions in D3 instead of in CSS - which I didn't
         * want to do because I would have transitions defined in two
         * locations: for this and for lines.
         * If I was very dedicated I could do that... but now? Nah...
         * Quick Google shows that it appears that yes, D3.js can animate
         * transforms. See here -> https://bl.ocks.org/mbostock/1345853
         */
        /*
        enter => {
          const enter = group.append("g").attr("class", "dot-group");
          enter.append("circle").attr("r", 15).attr("class", "dot-activation");
          enter.append("circle").attr("r", 4).attr("class", "dot");
          enter.style("transform", d => "translate(" +
            `${d.x + dimensions.boundedRadius}px,` +
            `${d.y + dimensions.boundedRadius}px)`,
          );
          return enter;
        }
        update => {
          update => update.style("transform", d => "translate(" +
            `${d.x + dimensions.boundedRadius}px,` +
            `${d.y + dimensions.boundedRadius}px)`,
          ),
        },
        */
      )
      .on("mouseenter", onMouseEnter)
      .on("mouseleave", onMouseLeave);
  };

  // Set up interactions.
  const tooltip = d3.select("#tooltip");

  const onMouseEnter = (_, datum) => {
    tooltip.style("transform", "translate("
      + `calc(${datum.x}px + -50% + ${dimensions.margin.left + dimensions.boundedRadius}px),`
      + `calc(${datum.y}px + -100% + ${dimensions.margin.top + dimensions.boundedRadius}px))`,
    )
    .style("opacity", 1);

    tooltip.select("#metric-name").text(datum.metric);
    tooltip.select("#value").text(d3.format(".2f")(datum.value));

  };
  const onMouseLeave = () => {
    tooltip.style("opacity", 0);
  };

  let activeDayIndex = 0;
  const title = d3.select("#title");
  const dateFormatter = d3.timeFormat("%B %-d, %Y");

  const updateChart = () => {
    title.text(dateFormatter(dateAccessor(dataset[activeDayIndex])));
    drawLine(dataset[activeDayIndex]);
  };

  updateChart();

  d3.select("#show-next-day").on("click", () => {
    activeDayIndex = (activeDayIndex + 1) % dataset.length;
    updateChart();
  });
}
drawBars();
