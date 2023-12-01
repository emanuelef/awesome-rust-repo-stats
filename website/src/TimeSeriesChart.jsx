import React, { useState, useEffect, useRef } from "react";
import FusionCharts from "fusioncharts";
import TimeSeries from "fusioncharts/fusioncharts.timeseries";
import ReactFC from "react-fusioncharts";
import CandyTheme from "fusioncharts/themes/fusioncharts.theme.candy";
import schema from "./schema";

ReactFC.fcRoot(FusionCharts, TimeSeries, CandyTheme);
const chart_props = {
  timeseriesDs: {
    type: "timeseries",
    width: "100%",
    height: "80%",
    dataEmptyMessage: "Fetching data...",
    dataSource: {
      caption: { text: "Daily Stars" },
      data: null,
      yAxis: [
        {
          plot: [
            {
              value: "New Stars",
            },
          ],
        },
      ],
      chart: {
        animation: "0",
        theme: "candy",
        exportEnabled: "1",
        exportMode: "client",
        exportFormats: "PNG=Export as PNG|PDF=Export as PDF",
      },
    },
  },
};

const API_URL =
  "https://raw.githubusercontent.com/emanuelef/awesome-rust-repo-stats/main/stars-history-30d.json";

function TimeSeriesChart({ repo }) {
  const [ds, setds] = useState(chart_props);
  const [dataLoaded, setDataLoaded] = useState(false);
  const dataRef = useRef([]);

  const loadData = async () => {
    try {
      if (dataRef.current.length === 0) {
        console.log("load all data");

        const response = await fetch(API_URL);
        const data = await response.json();

        console.log(data);

        dataRef.current = data;
        setDataLoaded(true);
        renderData();
      }
    } catch (err) {
      console.log(err);
    }
  };

  const renderData = () => {
    try {
      console.log(dataRef.current);

      if (dataRef.current.length === 0) {
        console.log("Rendering but no data");
        throw new Error("No data");
      }

      console.log("Shouldn't be here");

      const dataRepo = dataRef.current[repo];
      const fusionTable = new FusionCharts.DataStore().createDataTable(
        dataRepo,
        schema
      );
      const options = { ...ds };
      options.timeseriesDs.dataSource.data = fusionTable;
      options.timeseriesDs.dataSource.caption = {
        text: `Daily Stars ${repo}`,
      };
      options.timeseriesDs.dataSource.chart.exportFileName = `${repo.replace(
        "/",
        "_"
      )}-stars-history`;
      setds(options);
    } catch (err) {
      console.log(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  /*
  useEffect(() => {
    console.log("render");
    renderData();
  }, [repo]);
  */

  return (
    <div
      style={{
        marginLeft: "10px",
        marginTop: "10px",
        marginRight: "10px",
      }}
    >
      {dataLoaded && <ReactFC {...ds.timeseriesDs} />}
    </div>
  );
}

export default TimeSeriesChart;
