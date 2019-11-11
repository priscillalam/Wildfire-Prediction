# Terrain model

This subproject aims to model wildfire occurrence by looking at features from a satellite image.

We want to look at every pixel in a satellite image, and based on its landscape and terrain, predict how close it will be to a wildfire during wildfire season. Pixels with small predicted distances indicate that it may be more prone to wildfire while pixels with larger distances may indicate less likelihood of fire. We will use the pixel's hue as a measure of what type of landscape it contains.

Install dependencies with
`pip install -r requirements.txt`

We use pyproj to establish a method of conversion from pixel location to absolute location in the world. This can be done since the position and size of the image is fixed. We then take a series of annual images (2003 - 2018) of California from NASA around the start of fire season in early October. We pick dates that are free of clouds so the ground itself is visible. The json directory also contains a list of fires from each year from Ecowest. 

The Python script will take each pixel in each image, inspect its HSV value and extract the hue, then find the nearest wildfire that occurred that year and note its distance in meters. After repeating for all years, the script will round each hue to the nearest 0.001 and average out all the corresponding distances. It then produces a graph in `output/averages.png` with the x-axis being the hue and the y-axis being the average distance. It also generates an `output/averages.txt`. From the graph, reds and oranges tend to be closer to wildfires since they tend to contain dry vegetation. We can ignore blues since wildfires cannot happen on the ocean and much of California's dry land is coastal.

You can run this step with
`python main.py process`

The next stage is to read in a new image not used in the processing step and try to predict how far each pixel will be from a wildfire. We do this by placing a purple overlay on top of the image with a deeper purple signifying a closer distance to a wildfire and a ligher purple signifying the contrary. We read the image pixel by pixel and use the data from `output/averages.txt`. The resulting image is in `output/prediction.bmp`.

This can be run with
`python main.py predict`
