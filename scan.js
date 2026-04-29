// Updated scan.js to remove Anthropic API dependency

async function fetchJobs() {
    const jobs = [];
    // Simpler job fetching method using a public API or static data
    const response = await fetch('https://api.example.com/jobs'); // Replace with actual job fetching logic
    const data = await response.json();

    data.forEach(job => {
        jobs.push({
            title: job.title,
            company: job.company,
            location: job.location
        });
    });

    return jobs;
}

fetchJobs().then(jobs => console.log(jobs)).catch(err => console.error(err));