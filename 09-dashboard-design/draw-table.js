async function drawTable() {
  // load data
  const dateParser = d3.timeParse("%Y-%m-%d");
  const dateAccessor = d => dateParser(d.date);
  let dataset = await d3.json("../../resources/nyc_weather_data.json");
  dataset = dataset.sort((a,b) => dateAccessor(a) - dateAccessor(b));

  const table = d3.select("#table");

  const dateFormat = d => d3.timeFormat("%-m/%d")(dateParser(d));
  const hourFormat = d => d3.timeFormat("%-I %p")(new Date(d * 1000));
  const format24HourTime = d => +d3.timeFormat("%H")(new Date(d * 1000));

  const numberOfRows= 60;

  const columns = [
    {
      label: "Day",
      type: "text",
      format: d => dateFormat(d.date),
    },
    {
      label: "Summary",
      type: "text",
      format: d => d.summary,
    },
    {
      label: "Max Temp",
      type: "number",
      format: d => d.temperatureMax,
    },
    {
      label: "Max Temp Time",
      type: "text",
      format: d => hourFormat(d.apparentTemperatureMaxTime),
    },
    {
      label: "Wind Speed",
      type: "number",
      format: d => d.windSpeed,
    },
    {
      label: "Precipitation",
      type: "text",
      format: d => d.precipType,
    },
    {
      label: "UV Index",
      type: "number",
      format: d => d.uvIndex,
    },
  ];

  table.append("thead").append("tr")
    .selectAll("thead")
    .data(columns)
    .enter().append("th")
      .text(d => d.label)
      .attr("class", d => d.type);

  const body = table.append("tbody");

  dataset.slice(0, numberOfRows).forEach(d => {
    body.append("tr")
      .selectAll("td")
      .data(columns)
      .enter().append("td")
        .text(column => column.format(d))
        .attr("class", column => column.type);
  });
}
drawTable();
