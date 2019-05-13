import os
import pandas

def merge_for_render(
	historical_csv,
	prediction_csv,
	output_directory,
	start_year,
	end_year
	):
	combined_csv = pandas.concat(
	[pandas.read_csv(file) for file in [historical_csv, prediction_csv]])

	for year in range(start_year, end_year + 1):
		for month in range(1, 12 + 1):
			combined_csv[(combined_csv.year == year) & (combined_csv.month == month)] \
				.to_csv(output_directory + str(month) + str(year) + ".csv", index=False)
