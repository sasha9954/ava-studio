import { apiRequest } from './apiClient.js'

export async function listJobs() {
  return apiRequest('/jobs')
}

export async function createJob(payload) {
  return apiRequest('/jobs', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function completeJob(jobId, payload = {}) {
  return apiRequest(`/jobs/${jobId}/complete`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function failJob(jobId, payload = {}) {
  return apiRequest(`/jobs/${jobId}/fail`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
