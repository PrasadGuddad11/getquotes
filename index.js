const express = require('express');
const bodyParser = require('body-parser');
const moment = require('moment');
const nlp = require('compromise');

const app = express();
const port = 8080;

// Middleware
app.use(bodyParser.json());

// Helper functions
function extractCountriesAndCities(text) {
    const doc = nlp(text);
    const places = doc.places().out('array');

    let sourceAddress = null;
    let destinationAddress = null;

    if (places.length >= 2) {
        sourceAddress = places[0];
        destinationAddress = places[1];
    }

    return { sourceAddress, destinationAddress };
}

function extractWeight(text) {
    const weightPattern = /\b(\d+(\.\d+)?)\s*(kg|lb|lbs|kilograms|pounds)\b/i;
    const match = text.match(weightPattern);
    if (match) {
        return {
            value: parseFloat(match[1]),
            unit: match[3].toLowerCase(),
        };
    }
    return null;
}

function extractDimensions(text) {
    const dimensionPattern = /\b(\d+(\.\d+)?)\s*x\s*(\d+(\.\d+)?)\s*x\s*(\d+(\.\d+)?)\s*(cm|mm|in|inch|inches|meters|metres)\b/i;
    const match = text.match(dimensionPattern);
    if (match) {
        return {
            length: parseFloat(match[1]),
            width: parseFloat(match[3]),
            height: parseFloat(match[5]),
            unit: match[7].toLowerCase(),
        };
    }
    return null;
}

// Mock fetch quotes
function calculateQuote(payload,rate) {
    const ratePerKg = rate;  // Example rate per kg
    const ratePerCubicMeter = 100; // Example rate per cubic meter

    const weightCost = payload.package.weight.value * ratePerKg;
    const volume = (payload.package.dimensions.length / 100) * 
                    (payload.package.dimensions.width / 100) * 
                    (payload.package.dimensions.height / 100); // cubic meters
    const volumeCost = volume * ratePerCubicMeter;

    return weightCost + volumeCost;
}

// Route to parse email content and fetch quotes
app.post('/get-quotes', async (req, res) => {
    const emailText = req.body.text;

    if (!emailText) {
        return res.status(400).json({ error: 'Email text is required' });
    }

    const { sourceAddress, destinationAddress } = extractCountriesAndCities(emailText);
    const weight = extractWeight(emailText);
    const dimensions = extractDimensions(emailText);

    if (!sourceAddress || !destinationAddress || !weight || !dimensions) {
        return res.status(400).json({ error: 'Could not extract all required information' });
    }

    // Creating the payload
    const payload = {
        sourceAddress,
        destinationAddress,
        package: {
            weight,
            dimensions,
            plannedShippingDate: moment().format('YYYY-MM-DD'),
        },
    };

    const dhlQuote = calculateQuote(payload,10);
    const fedexQuote = calculateQuote(payload,12);
    const upsQuote = calculateQuote(payload,14);

    res.json({
        success: true,
        extraction: payload,
        quotes: {
            DHL: `$${dhlQuote}`,
            FedEx: `$${fedexQuote}`, 
            UPS: `$${upsQuote}`
        }
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Email parser app listening at http://localhost:${port}`);
});
