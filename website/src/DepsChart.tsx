import React, { useState, useEffect, useCallback } from "react";
import Linkweb from "@mui/material/Link";
import Papa from "papaparse";
import "./App.css";
import { DataGrid, GridColDef } from "@mui/x-data-grid";

const CratesURL = "https://crates.io/crates/";

const csvURL =
  "https://raw.githubusercontent.com/emanuelef/awesome-rust-repo-stats/main/dep-repo-latest.csv";

function formatNumber(number) {
  const absNumber = Math.abs(number);

  if (absNumber >= 1e6) {
    // Millions
    return (number / 1e6).toFixed(1) + "M";
  } else if (absNumber >= 1e3) {
    // Thousands
    return (number / 1e3).toFixed(1) + "K";
  } else {
    // Less than 1000
    return number.toString();
  }
}

// renderCell: (params) => calculateAge(params.value),

const columns: GridColDef[] = [
  {
    field: "dep",
    headerName: "Module",
    width: 220,
    renderCell: (params) => (
      <Linkweb href={CratesURL + params.value} target="_blank">
        {params.value}
      </Linkweb>
    ),
  },
  {
    field: "awesome_rust_repos_using_dep",
    headerName: "Repos in Awesome Rust using it",
    width: 100,
    valueGetter: (params) => parseInt(params.value),
  },
  {
    field: "crate_total_downloads",
    headerName: "Total Downloads",
    width: 100,
    valueGetter: (params) => parseInt(params.value),
    renderCell: (params) => formatNumber(params.value),
  },
];

function DepsChart() {
  const [dataRows, setDataRows] = useState([]);

  const loadData = async () => {
    fetch(csvURL)
      .then((response) => response.text())
      .then((text) => Papa.parse(text, { header: true, skipEmptyLines: true }))
      .then(function (result) {
        console.log(result);
        setDataRows(result.data);
      })
      .catch((e) => {
        console.error(`An error occurred: ${e}`);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div
      style={{
        marginLeft: "10px",
        marginTop: "10px",
        width: "400px",
        height: "86%",
      }}
    >
      <DataGrid
        getRowId={(row) => row.dep}
        rows={dataRows}
        columns={columns}
        rowHeight={30}
        initialState={{
          pagination: {
            paginationModel: { page: 0, pageSize: 25 },
          },
          sorting: {
            sortModel: [
              { field: "awesome_rust_repos_using_dep", sort: "desc" },
            ],
          },
        }}
        pageSizeOptions={[5, 10, 50]}
      />
    </div>
  );
}

export default DepsChart;
