// Adds the vote buttons and the community rating to a job's page.
import { fetchSummaries, voteWidget } from '/votes.js';
import { appliedButton } from '/applied.js';

const job = JSON.parse(document.getElementById('job-data').textContent);
const mount = document.getElementById('vote-mount');

function draw(summary) {
  mount.replaceChildren(voteWidget(job, summary, draw));
}

draw(null);
fetchSummaries([job.id])
  .then((m) => draw(m.get(job.id) ?? null))
  .catch(() => {
    // Votes unavailable; the buttons will say so if someone tries.
  });

document.getElementById('applied-mount')?.append(appliedButton(job.id));
