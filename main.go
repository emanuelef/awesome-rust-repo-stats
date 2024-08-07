package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httptrace"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/emanuelef/awesome-rust-repo-stats/otel_instrumentation"
	"github.com/emanuelef/github-repo-activity-stats/repostats"
	"github.com/emanuelef/github-repo-activity-stats/stats"
	"github.com/go-resty/resty/v2"
	_ "github.com/joho/godotenv/autoload"
	"go.opentelemetry.io/contrib/instrumentation/net/http/httptrace/otelhttptrace"
	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/oauth2"
)

const (
	AwesomeGoMarkdownUrl = "https://raw.githubusercontent.com/rust-unofficial/awesome-rust/main/README.md"
	CrateAPIUrl          = "https://crates.io/api/v1/crates/%s"
)

type CrateData struct {
	Categories []struct {
		Category string `json:"category"`
	} `json:"categories"`
	Crate struct {
		Description     string `json:"description"`
		Downloads       int    `json:"downloads"`
		RecentDownloads int    `json:"recent_downloads"`
		RepoUrl         string `json:"repository"`
	} `json:"crate"`
}

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if len(value) == 0 {
		return defaultValue
	}
	return value
}

func writeGoDepsMapFile(ctx context.Context, deps map[string]int, restyClient *resty.Client) {
	currentTime := time.Now()
	outputFile, err := os.Create(fmt.Sprintf("dep-repo-%s.csv", getEnv("FILE_SUFFIX", (currentTime.Format("02-01-2006")))))
	if err != nil {
		log.Fatal(err)
	}

	defer outputFile.Close()

	csvWriter := csv.NewWriter(outputFile)
	defer csvWriter.Flush()

	headerRow := []string{
		"dep", "awesome_rust_repos_using_dep", "crate_category",
		"crate_total_downloads", "crate_recent_downloads", "repo_url",
	}

	err = csvWriter.Write(headerRow)

	if err != nil {
		log.Fatal(err)
	}

	for dep, occurrences := range deps {
		if occurrences > 10 {
			restyReq := restyClient.R().SetResult(&CrateData{})
			restyReq.SetContext(ctx)
			resp, err := restyReq.Get(fmt.Sprintf(CrateAPIUrl, dep))
			if err != nil {
				continue
				// log.Fatal(err)
			}

			if resp.StatusCode() != 200 {
				continue
				// log.Fatalf("Non-200 status code received: %d", resp.StatusCode())
			}

			data := resp.Result().(*CrateData)

			firstCategory := ""
			totalDownloads := data.Crate.Downloads
			recentDownloads := data.Crate.RecentDownloads

			for _, category := range data.Categories {
				if category.Category != "No standard library" {
					firstCategory = category.Category
					break
				}
			}

			err = csvWriter.Write([]string{
				dep,
				fmt.Sprintf("%d", occurrences),
				firstCategory,
				fmt.Sprintf("%d", totalDownloads),
				fmt.Sprintf("%d", recentDownloads),
				data.Crate.RepoUrl,
			})

			if err != nil {
				log.Fatal(err)
			}
		}
	}
}

var tracer trace.Tracer

func init() {
	tracer = otel.Tracer("github.com/emanuelef/awesome-rust-repo-stats")
}

func main() {
	ctx := context.Background()

	starsHistory := map[string][]stats.StarsPerDay{}
	commitsHistory := map[string][]stats.CommitsPerDay{}

	tp, exp, err := otel_instrumentation.InitializeGlobalTracerProvider(ctx)
	// Handle shutdown to ensure all sub processes are closed correctly and telemetry is exported
	if err != nil {
		log.Fatalf("failed to initialize OpenTelemetry: %e", err)
	}

	ctx, span := tracer.Start(ctx, "fetch-all-stats")

	defer func() {
		fmt.Println("before End")
		span.End()
		time.Sleep(10 * time.Second)
		fmt.Println("before exp Shutdown")
		_ = exp.Shutdown(ctx)
		fmt.Println("before tp Shutdown")
		_ = tp.Shutdown(ctx)
	}()

	currentTime := time.Now()
	outputFile, err := os.Create(fmt.Sprintf("analysis-%s.csv", getEnv("FILE_SUFFIX", currentTime.Format("02-01-2006"))))
	if err != nil {
		log.Fatal(err)
	}

	defer outputFile.Close()

	csvWriter := csv.NewWriter(outputFile)
	defer csvWriter.Flush()

	headerRow := []string{
		"repo", "stars", "new-stars-last-30d", "new-stars-last-14d",
		"new-stars-last-7d", "new-stars-last-24H", "stars-per-mille-30d",
		"days-last-star", "days-last-commit",
		"days-since-creation", "mentionable-users",
		"language",
		"archived", "dependencies",
		"main-category", "sub-category",
		"liveness",
		"unique-contributors",
		"new-commits-last-30d",
	}

	err = csvWriter.Write(headerRow)

	if err != nil {
		log.Fatal(err)
	}

	depsUse := map[string]int{}

	tokenSource := oauth2.StaticTokenSource(
		&oauth2.Token{AccessToken: os.Getenv("PAT")},
	)

	oauthClient := oauth2.NewClient(context.Background(), tokenSource)
	client := repostats.NewClientGQL(oauthClient)

	restyClient := resty.NewWithClient(
		&http.Client{
			Transport: otelhttp.NewTransport(http.DefaultTransport,
				otelhttp.WithClientTrace(func(ctx context.Context) *httptrace.ClientTrace {
					return otelhttptrace.NewClientTrace(ctx)
				})),
		},
	)

	restyReq := restyClient.R()
	restyReq.SetContext(ctx)
	resp, err := restyReq.Get(AwesomeGoMarkdownUrl)
	i := 0
	if err == nil {
		reader := bytes.NewReader([]byte(resp.Body()))
		scanner := bufio.NewScanner(reader)

		// * [dust](https://github.com/bootandy/dust) — A more intuitive version of du
		exp := regexp.MustCompile(`\* \[[^\]]+\]\s*\(https?://github\.com/([^/\s]+/[^/\s]+)\)`)

		mainCategory := "General"
		subCategory := ""

		for scanner.Scan() {
			line := scanner.Text()
			line = strings.TrimLeft(line, " ")
			line = strings.ReplaceAll(line, "—", "-")

			if strings.HasPrefix(line, "## ") {
				fmt.Println(line)
				cleanedLine := strings.TrimPrefix(line, "## ")

				if mainCategory != cleanedLine {
					subCategory = ""
					mainCategory = cleanedLine
				}
			}

			if strings.HasPrefix(line, "### ") {
				fmt.Println(line)
				subCategory = strings.TrimPrefix(line, "### ")
			}

			subMatch := exp.FindStringSubmatch(line)
			if len(subMatch) >= 2 {
				repo := subMatch[1]

				fmt.Printf("line : %s\n", line)
				fmt.Printf("repo : %d %s\n", i, repo)
				i += 1

				result, err := client.GetAllStats(ctx, repo)
				if err != nil {
					// retry once
					fmt.Println("retrying after 5 minutes")
					time.Sleep(5 * time.Minute)
					result, err = client.GetAllStats(ctx, repo)
					/*
						if err != nil {
							log.Fatal(err)
						}
					*/
				}

				if err == nil {
					daysSinceLastStar := int(currentTime.Sub(result.LastStarDate).Hours() / 24)
					daysSinceLastCommit := int(currentTime.Sub(result.LastCommitDate).Hours() / 24)
					daysSinceCreation := int(currentTime.Sub(result.CreatedAt).Hours() / 24)
					err = csvWriter.Write([]string{
						repo,
						fmt.Sprintf("%d", result.Stars),
						fmt.Sprintf("%d", result.StarsHistory.AddedLast30d),
						fmt.Sprintf("%d", result.StarsHistory.AddedLast14d),
						fmt.Sprintf("%d", result.StarsHistory.AddedLast7d),
						fmt.Sprintf("%d", result.StarsHistory.AddedLast24H),
						fmt.Sprintf("%.3f", result.StarsHistory.AddedPerMille30d),
						fmt.Sprintf("%d", daysSinceLastStar),
						fmt.Sprintf("%d", daysSinceLastCommit),
						fmt.Sprintf("%d", daysSinceCreation),
						fmt.Sprintf("%d", result.MentionableUsers),
						result.Language,
						fmt.Sprintf("%t", result.Archived),
						fmt.Sprintf("%d", len(result.DirectDeps)),
						fmt.Sprintf(mainCategory),
						fmt.Sprintf(subCategory),
						fmt.Sprintf("%.3f", result.LivenessScore),
						fmt.Sprintf("%d", result.DifferentAuthors),
						fmt.Sprintf("%d", result.CommitsHistory.AddedLast30d),
					})

					if err != nil {
						log.Fatal(err)
					}

					if len(result.DirectDeps) > 0 {
						for _, dep := range result.DirectDeps {
							depsUse[dep] += 1
						}
					}

					starsHistory[repo] = result.StarsTimeline
					commitsHistory[repo] = result.CommitsTimeline

					// wait to avoid hitting 5k rate limit
					if i%100 == 0 {
						time.Sleep(2 * time.Minute)
					}

				}

			}
		}

		writeGoDepsMapFile(ctx, depsUse, restyClient)

		jsonData, _ := json.MarshalIndent(starsHistory, "", " ")
		_ = os.WriteFile("stars-history-30d.json", jsonData, 0o644)

		commitsJsonData, _ := json.MarshalIndent(commitsHistory, "", " ")
		_ = os.WriteFile("commits-history-30d.json", commitsJsonData, 0o644)
	}

	elapsed := time.Since(currentTime)
	log.Printf("Took %s\n", elapsed)
}
