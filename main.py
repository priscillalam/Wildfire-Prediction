from process import process_csvs
from learn import predict
from merge import merge_for_render

import os
import shutil
import sys

CSV_OUTPUT_DIRECTORY = "csv_outputs/"
PROCESSED_CSV_FILENAME = CSV_OUTPUT_DIRECTORY + "processed.csv"
PREDICT_CSV_FILENAME = CSV_OUTPUT_DIRECTORY + "predict.csv"
RENDER_DIRECTORY = "render/public/csv/"

if len(sys.argv) >= 2 and sys.argv[1] == "clean":
    print("Cleaning output directories...")
    if os.path.exists(CSV_OUTPUT_DIRECTORY):
        shutil.rmtree(CSV_OUTPUT_DIRECTORY)
    if os.path.exists(RENDER_DIRECTORY):
        shutil.rmtree(RENDER_DIRECTORY)
    exit()

YEAR_START = 1992
YEAR_END = 2015
PREDICT_START = 2016
PREDICT_END = 2024

if not os.path.exists(CSV_OUTPUT_DIRECTORY):
    os.makedirs(CSV_OUTPUT_DIRECTORY)

input_csvs = [
    'data/us_fires_1.csv',
    'data/us_fires_2.csv',
    'data/us_fires_3.csv',
    'data/us_fires_4.csv',
    'data/us_fires_5.csv',
    'data/us_fires_6.csv',
    'data/us_fires_7.csv'
]

print("Processing input CSVs...")
process_csvs(input_csvs, PROCESSED_CSV_FILENAME)
print("Running prediction...")
predict(
   PROCESSED_CSV_FILENAME,
   PREDICT_CSV_FILENAME,
	YEAR_START,
	YEAR_END,
	PREDICT_START,
	PREDICT_END
)
if not os.path.exists(RENDER_DIRECTORY):
	os.makedirs(RENDER_DIRECTORY)
print("Merging CSVs for render...")
merge_for_render(
    PROCESSED_CSV_FILENAME,
    PREDICT_CSV_FILENAME,
    RENDER_DIRECTORY,
    YEAR_START,
    PREDICT_END)
