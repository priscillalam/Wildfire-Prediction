# Time Series model

[Demo here](https://priscillalam.github.io/Wildfire-Prediction/)

This subproject aims to model wildfire occurrence as a time series model.

We first take a list of fires compiled by the US Forest Service that have occurred from 1992-2015. This is stored in `data/`. Then, we partition a map of the US into 0.5 degree by 0.5 degree cells. For each month in the dataset, we calculate how many acres were burned within each cell. We then note the number of months from that month to the peak of fire season (usually August) and the year that month was in. We run a linear regression on each cell in the grid to determine the number of acres burned within that cell as a function of number of months from peak fire season and the calendar year. This function can then be used to predict the number of acres burned within a specific area for future months outside of the initial dataset.

The model is useful for visualizing trends in wildfires accross time and provides a visualization for which areas we can expect to have the most wildfire activity. This repository contains a Python script that reads the CSV and buckets the data, then uses Scikit to run the linear regression.

Install the dependencies with
`pip install -r requirements.txt`

Then run the script
`python main.py`

You can view the output by uploading the `render/` directory to a HTTP server or by installing a CORS override to allow loading local files.

You can clean the output with `python main.py clean`

### Sources
https://github.com/BuzzFeedNews/2018-07-wildfire-trends for the input CSV files
