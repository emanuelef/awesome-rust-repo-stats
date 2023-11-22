import React, { useState, useEffect } from "react";
import Plot from "react-plotly.js";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Papa from "papaparse";

const fullStarsHistoryURL =
  "https://emanuelef.github.io/gh-repo-stats-server/#";

const csvURL =
  "https://raw.githubusercontent.com/emanuelef/awesome-rust-repo-stats/main/analysis-latest.csv";

const logBase = (n, base) => Math.log(n) / Math.log(base);

const categories = [
  "Applications",
  "Development tools",
  "Libraries",
  "Registries",
  "Resources",
];

const mapCategoryToColor = (category) => {
  const colorMappings = {
    [categories[0]]: "rgb(93, 164, 214)",
    [categories[1]]: "rgb(55, 44, 184)",
    [categories[2]]: "rgb(44, 160, 101)",
    [categories[3]]: "rgb(244, 60, 101)",
    [categories[4]]: "rgb(244, 160, 71)",
  };

  // Return the color for the given category, or a default color if not found
  return colorMappings[category] || "rgb(0, 0, 0)"; // Default to black if not found
};

const clickActions = [
  { label: "GH Repo", action: "gh" },
  { label: "Last 30d stars", action: "30d" },
  { label: "Full Star history", action: "full" },
];

const axisMetrics = [
  { label: "Stars Last 7 Days", metric: "new-stars-last-7d" },
  { label: "Stars Last 14 Days", metric: "new-stars-last-14d" },
  { label: "Stars Last 30 Days", metric: "new-stars-last-30d" },
  { label: "Mentionable Users", metric: "mentionable-users" },
  { label: "Total Stars", metric: "stars" },
  { label: "New Stars 30d‰", metric: "stars-per-mille-30d" },
  { label: "Age", metric: "days-since-creation" },
  { label: "Unique contributors 30d", metric: "unique-contributors" },
  { label: "Commits Last 30 Days", metric: "new-commits-last-30d" },
];

const sizeMetrics = [
  { label: "Total Stars", metric: "stars" },
  { label: "Same", metric: "same" },
  { label: "Commits Last 30 Days", metric: "new-commits-last-30d" },
];

const formatStars = (stars) => {
  if (stars >= 1000) {
    return `${(stars / 1000).toFixed(1)}k`;
  } else {
    return stars.toString();
  }
};

const calculateAge = (days) => {
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  const remainingDays = days % 30;

  return `${years !== 0 ? `${years}y ` : ""}${
    months !== 0 ? `${months}m ` : ""
  }${remainingDays}d`;
};

const BubbleChart = ({ dataRows }) => {
  const [maxDaysLastCommit, setMaxDaysLastCommit] = useState("30");
  const [minStars, setMinStars] = useState("10");
  const [minMentionableUsers, setMinMentionableUsers] = useState("1");
  const [data, setData] = useState([]);
  const [selectedAction, setSelectedAction] = useState(clickActions[0].action);

  const [selectedXAxis, setSelectedXAxis] = useState(axisMetrics[0]);
  const [selectedYAxis, setSelectedYAxis] = useState(axisMetrics[3]);

  const [selectedSize, setSelectedSize] = useState(sizeMetrics[0]);

  const handleInputChange = (event, setStateFunction) => {
    const inputText = event.target.value;

    // Use a regular expression to check if the input contains only digits
    if (/^\d*$/.test(inputText)) {
      setStateFunction(inputText);
    }
  };

  const handleBubbleClick = (event) => {
    const pointIndex = event.points[0].pointIndex;
    const clickedRepo = event.points[0].data.repo[pointIndex];

    let url = `https://github.com/${clickedRepo}`;

    switch (selectedAction) {
      case "gh":
        window.open(url, "_blank");
        break;

      case "30d":
        url = `./#/starstimeline/${clickedRepo}`;
        window.location.href = url;
        break;

      case "full":
        url = `${fullStarsHistoryURL}/${clickedRepo}`;
        window.open(url, "_blank");
        break;

      default:
        window.open(url, "_blank");
        break;
    }
  };

  const buildChartData = (dataRows) => {
    let updatedData = [];

    dataRows.forEach((element) => {
      if (
        parseInt(element["days-last-commit"]) < parseInt(maxDaysLastCommit) &&
        parseInt(element["stars"]) > parseInt(minStars) &&
        parseInt(element["mentionable-users"]) > parseInt(minMentionableUsers)
      ) {
        updatedData.push(element);
      }
    });

    let filteredData = [];

    categories.forEach((category) => {
      console.log(category);

      let updatedCategoryData = updatedData.filter(
        (row) => row["main-category"] === category
      );

      const trace = {
        x: updatedCategoryData.map((row) => row[selectedXAxis.metric]),
        y: updatedCategoryData.map((row) => row[selectedYAxis.metric]),
        repo: updatedCategoryData.map((row) => `${row.repo}`),
        text: updatedCategoryData.map(
          (row) =>
            `${row.repo}<br>Total Stars: ${formatStars(
              row.stars
            )}<br>Last commit: ${
              row["days-last-commit"]
            } days ago<br>Age: ${calculateAge(
              row["days-since-creation"]
            )}<br>Commits last 30d: ${row["new-commits-last-30d"]} `
        ),
        mode: "markers",
        marker: {
          size:
            selectedSize.metric == "stars" ||
            selectedSize.metric == "new-commits-last-30d"
              ? updatedCategoryData.map(
                  (row) => Math.sqrt(row[selectedSize.metric]) * 7
                )
              : updatedCategoryData.map(() => 600),
          sizemode: "diameter",
          sizeref: selectedSize.metric == "new-commits-last-30d" ? 2.0 : 20.03,
          color: mapCategoryToColor(category),
        },
        type: "scatter",
        name: category,
      };

      filteredData.push(trace);
    });

    setData(filteredData);
  };

  const loadData = async () => {
    if (dataRows.length == 0) {
      fetch(csvURL)
        .then((response) => response.text())
        .then((text) =>
          Papa.parse(text, { header: true, skipEmptyLines: true })
        )
        .then(function (result) {
          buildChartData(result.data);
        })
        .catch((e) => {
          console.error(`An error occurred: ${e}`);
        });
    } else {
      buildChartData(dataRows);
    }
  };

  useEffect(() => {
    loadData();
  }, [
    maxDaysLastCommit,
    minStars,
    minMentionableUsers,
    selectedAction,
    selectedXAxis,
    selectedYAxis,
    selectedSize,
  ]);

  const layout = {
    xaxis: {
      type: "log",
      title: selectedXAxis.label,
      gridcolor: "rgba(150, 150, 150, 0.6)",
    },
    yaxis: {
      type: "log",
      title: selectedYAxis.label,
      gridcolor: "rgba(150, 150, 150, 0.6)",
    },
    size: "stars",
    color: "main-category",
    hovermode: "closest",
    hover_name: "repo",
    showlegend: true,
    margin: {
      t: 30, // Adjusted top margin
      r: 20,
      b: 50, // Adjusted bottom margin
      l: 50,
    },
    paper_bgcolor: "rgb(0, 0, 0, 0.7)", // Transparent background
    plot_bgcolor: "rgba(38, 42, 51, 0.8)", // Dark background
    font: { color: "white" }, // White text
  };

  return (
    <div
      style={{
        marginLeft: "10px",
        marginTop: "10px",
        marginRight: "10px",
        height: "90%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginTop: "20px",
          marginBottom: "10px",
        }}
      >
        <TextField
          style={{ marginRight: "10px", marginLeft: "10px", width: "150px" }}
          label="Days since last commit"
          variant="outlined"
          size="small"
          value={maxDaysLastCommit}
          onChange={(e) => handleInputChange(e, setMaxDaysLastCommit)}
          InputProps={{
            inputProps: {
              pattern: "[0-9]*",
              inputMode: "numeric",
            },
          }}
        />
        <TextField
          style={{ marginRight: "10px", width: "100px" }}
          label="Min stars"
          variant="outlined"
          size="small"
          value={minStars}
          onChange={(e) => handleInputChange(e, setMinStars)}
          InputProps={{
            inputProps: {
              pattern: "[0-9]*",
              inputMode: "numeric",
            },
          }}
        />
        <TextField
          style={{ width: "120px" }}
          label="Min men. users"
          variant="outlined"
          size="small"
          value={minMentionableUsers}
          onChange={(e) => handleInputChange(e, setMinMentionableUsers)}
          InputProps={{
            inputProps: {
              pattern: "[0-9]*",
              inputMode: "numeric",
            },
          }}
        />
        <Autocomplete
          disablePortal
          style={{ marginLeft: "10px" }}
          id="actions-combo-box"
          size="small"
          options={clickActions}
          sx={{ width: 220 }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Select an action on click"
              variant="outlined"
              size="small"
            />
          )}
          value={
            clickActions.find((element) => element.action === selectedAction) ??
            ""
          }
          onChange={(e, v, reason) => {
            if (reason === "clear") {
              setSelectedAction(clickActions[0].action);
            } else {
              setSelectedAction(v?.action);
            }
          }}
        />
        <Autocomplete
          disablePortal
          style={{ marginLeft: "10px" }}
          id="actions-x-box"
          size="small"
          options={axisMetrics}
          sx={{ width: 220 }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Select X axis metric"
              variant="outlined"
              size="small"
            />
          )}
          value={
            axisMetrics.find(
              (element) => element.metric === selectedXAxis.metric
            ) ?? ""
          }
          onChange={(e, v, reason) => {
            if (reason === "clear") {
              setSelectedXAxis(axisMetrics[0]);
            } else {
              setSelectedXAxis(v);
            }
          }}
        />
        <Autocomplete
          disablePortal
          style={{ marginLeft: "10px" }}
          id="actions-y-box"
          size="small"
          options={axisMetrics}
          sx={{ width: 220 }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Select Y axis metric"
              variant="outlined"
              size="small"
            />
          )}
          value={
            axisMetrics.find(
              (element) => element.metric === selectedYAxis.metric
            ) ?? ""
          }
          onChange={(e, v, reason) => {
            if (reason === "clear") {
              setSelectedYAxis(axisMetrics[3]);
            } else {
              setSelectedYAxis(v);
            }
          }}
        />
        <Autocomplete
          disablePortal
          style={{ marginLeft: "10px" }}
          id="actions-y-box"
          size="small"
          options={sizeMetrics}
          sx={{ width: 200 }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Select size metric"
              variant="outlined"
              size="small"
            />
          )}
          value={
            sizeMetrics.find(
              (element) => element.metric === selectedSize.metric
            ) ?? ""
          }
          onChange={(e, v, reason) => {
            if (reason === "clear") {
              setSelectedSize(sizeMetrics[0]);
            } else {
              setSelectedSize(v);
            }
          }}
        />
      </div>
      <Plot
        data={data}
        layout={layout}
        style={{ width: "100%", height: "90%" }}
        onClick={(event) => handleBubbleClick(event)}
      />
    </div>
  );
};

export default BubbleChart;
