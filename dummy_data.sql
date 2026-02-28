-- Populate Dummy Leads
INSERT INTO leads (name, email, phone, service, budget, status, details) VALUES
('John Doe', 'john@bigtech.com', '+1234567890', 'Web Development', '$5000 - $20000', 'New', 'Need a high-performance e-commerce site.'),
('Jane Smith', 'jane@startup.io', '+1987654321', 'UI/UX Design', '$1000 - $5000', 'In Progress', 'Revamping our mobile app interface.'),
('Alice Johnson', 'alice@edu.org', '+1122334455', 'Mobile App', 'Above $20000', 'Converted', 'Educational platform for remote learning.'),
('Bob Williams', 'bob@builder.com', '+1555666777', 'Consultation', 'Under $1000', 'New', 'Strategic advice for local business growth.'),
('Charlie Brown', 'charlie@peanuts.com', '+1444333222', 'Web Development', '$5000 - $20000', 'New', 'Portfolio site for creative agency.'),
('David Miller', 'david@fintech.net', '+1777888999', 'SEO & Marketing', '$1000 - $5000', 'In Progress', 'Optimizing our SaaS landing pages.'),
('Eve Adams', 'eve@fashion.fr', '+33123456789', 'UI/UX Design', '$5000 - $20000', 'New', 'High-end fashion brand redesign.'),
('Frank Wright', 'frank@arch.com', '+1222333444', 'Web Development', 'Above $20000', 'New', 'Architectural firm digital presence.'),
('Grace Hopper', 'grace@code.dev', '+1666777888', 'Mobile App', '$5000 - $20000', 'New', 'Inventory management system.'),
('Hank Pym', 'hank@pymtech.com', '+1999000111', 'Consultation', 'Under $1000', 'In Progress', 'Quantum computing UI consultation.');

-- Populate Dummy Clients
INSERT INTO clients (full_name, company, project_name, total_value, paid_amount, status, review) VALUES
('Sarah Connor', 'Cyberdyne Systems', 'T-800 Interface', '$15000', '$10000', 'In Progress', null),
('Tony Stark', 'Stark Industries', 'Arc Reactor Dashboard', '$50000', '$50000', 'Launched', '{"rating": 5, "comment": "Exceptional work, very efficient.", "isPublic": true}'),
('Bruce Wayne', 'Wayne Enterprises', 'Batcave Monitoring', '$25000', '$5000', 'In Progress', null),
('Peter Parker', 'Daily Bugle', 'Photo Submission Portal', '$2000', '$2000', 'Completed', '{"rating": 4, "comment": "Good job, but could be faster.", "isPublic": true}'),
('Clark Kent', 'Planet Labs', 'Global News Feed', '$8000', '$4000', 'In Progress', null),
('Diana Prince', 'Themyscira Arts', 'Ancient Artifacts CRM', '$12000', '$12000', 'Launched', '{"rating": 5, "comment": "Truly timeless design.", "isPublic": true}'),
('Barry Allen', 'Central City PD', 'Evidence Log System', '$5000', '$1000', 'In Progress', null),
('Arthur Curry', 'Atlantis Aquatics', 'Ocean Depth Analytics', '$18000', '$18000', 'Completed', '{"rating": 3, "comment": "Communication was a bit slow.", "isPublic": true}'),
('Wanda Maximoff', 'Westview Magic', 'Reality Warp UI', '$30000', '$15000', 'In Progress', null),
('Stephen Strange', 'Sanctum Digital', 'Mystic Arts Portal', '$45000', '$45000', 'Launched', '{"rating": 5, "comment": "The UX is almost magical.", "isPublic": true}');

-- Populate Dummy Transactions
-- Note: Replace UUIDs with actual IDs after running the above or use subqueries
INSERT INTO transactions (client_id, type, amount, description, category, status, date)
SELECT id, 'Income', 10000, 'Initial Deposit', 'Web Development', 'Completed', NOW() - INTERVAL '15 days' FROM clients WHERE full_name = 'Sarah Connor';
INSERT INTO transactions (client_id, type, amount, description, category, status, date)
SELECT id, 'Income', 50000, 'Final Payment', 'Consultation', 'Completed', NOW() - INTERVAL '30 days' FROM clients WHERE full_name = 'Tony Stark';
INSERT INTO transactions (client_id, type, amount, description, category, status, date)
SELECT id, 'Income', 5000, 'Down Payment', 'Mobile App', 'Completed', NOW() - INTERVAL '5 days' FROM clients WHERE full_name = 'Bruce Wayne';
INSERT INTO transactions (client_id, type, amount, description, category, status, date)
SELECT id, 'Income', 2000, 'Full Payment', 'SEO', 'Completed', NOW() - INTERVAL '40 days' FROM clients WHERE full_name = 'Peter Parker';
INSERT INTO transactions (client_id, type, amount, description, category, status, date)
SELECT id, 'Income', 4000, 'Milestone 1', 'Web Development', 'Completed', NOW() - INTERVAL '10 days' FROM clients WHERE full_name = 'Clark Kent';
INSERT INTO transactions (client_id, type, amount, description, category, status, date)
SELECT id, 'Income', 12000, 'Project Completion', 'UI/UX Design', 'Completed', NOW() - INTERVAL '20 days' FROM clients WHERE full_name = 'Diana Prince';
INSERT INTO transactions (client_id, type, amount, description, category, status, date)
SELECT id, 'Income', 1000, 'Consultation Fee', 'Consultation', 'Completed', NOW() - INTERVAL '2 days' FROM clients WHERE full_name = 'Barry Allen';
INSERT INTO transactions (client_id, type, amount, description, category, status, date)
SELECT id, 'Income', 18000, 'Project Total', 'Data Analytics', 'Completed', NOW() - INTERVAL '50 days' FROM clients WHERE full_name = 'Arthur Curry';
INSERT INTO transactions (client_id, type, amount, description, category, status, date)
SELECT id, 'Income', 15000, 'Upfront', 'Web Development', 'Completed', NOW() - INTERVAL '12 days' FROM clients WHERE full_name = 'Wanda Maximoff';
INSERT INTO transactions (client_id, type, amount, description, category, status, date)
SELECT id, 'Income', 45000, 'Full Settlement', 'UI/UX Design', 'Completed', NOW() - INTERVAL '60 days' FROM clients WHERE full_name = 'Stephen Strange';

-- Dummy Expenses
INSERT INTO transactions (type, amount, description, category, status, date) VALUES
('Expense', 500, 'Server Hosting', 'Infrastructure', 'Completed', NOW() - INTERVAL '25 days'),
('Expense', 1200, 'External Designer', 'Labor', 'Completed', NOW() - INTERVAL '18 days'),
('Expense', 300, 'Software Licenses', 'Tools', 'Completed', NOW() - INTERVAL '10 days'),
('Expense', 800, 'Marketing Ads', 'Marketing', 'Completed', NOW() - INTERVAL '5 days'),
('Expense', 150, 'Office Supplies', 'Admin', 'Completed', NOW() - INTERVAL '30 days');
