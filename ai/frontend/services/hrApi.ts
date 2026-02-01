const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

export async function getJobs(token: string, query?: string) {
    try {
        const url = query 
            ? `${API_BASE}/api/hr/jobs?q=${encodeURIComponent(query)}`
            : `${API_BASE}/api/hr/jobs`;
            
        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to fetch jobs");
        return await res.json();
    } catch (err) {
        console.error(err);
        return [];
    }
}

export async function applyForJob(application: { job_id: number; candidate_name: string; candidate_email: string; resume_text: string }, token: string) {
    try {
        const res = await fetch(`${API_BASE}/api/hr/apply`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}` 
            },
            body: JSON.stringify(application)
        });
        return await res.json();
    } catch (err) {
        console.error(err);
        return { success: false, error: "Network error" };
    }
}

export async function logSearch(query: string, user_id: string, token: string) {
    try {
        await fetch(`${API_BASE}/api/hr/search-log`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}` 
            },
            body: JSON.stringify({ query, user_id })
        });
    } catch (err) {
        console.error(err);
    }
}

export async function getLiveSearches(token: string) {
    try {
        const res = await fetch(`${API_BASE}/api/hr/live-searches`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to fetch searches");
        return await res.json();
    } catch (err) {
        console.error(err);
        return [];
    }
}

export async function postJob(job: { title: string; description: string; requirements: string[] }, token: string) {
    try {
        const res = await fetch(`${API_BASE}/api/hr/post-job`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}` 
            },
            body: JSON.stringify(job)
        });
        return await res.json();
    } catch (err) {
        console.error(err);
        return { success: false, error: "Network error" };
    }
}

export async function getEmails(token: string) {
    try {
        const res = await fetch(`${API_BASE}/api/hr/emails`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to fetch emails");
        return await res.json();
    } catch (err) {
        console.error(err);
        return [];
    }
}

export async function postEmail(email: { title: string; content: string; email_address?: string; type?: string }, token: string) {
    try {
        const res = await fetch(`${API_BASE}/api/hr/emails`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}` 
            },
            body: JSON.stringify(email)
        });
        return await res.json();
    } catch (err) {
        console.error(err);
        return { success: false, error: "Network error" };
    }
}
