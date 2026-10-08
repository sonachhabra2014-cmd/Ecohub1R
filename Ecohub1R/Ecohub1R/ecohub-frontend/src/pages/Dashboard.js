import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";

function Dashboard() {
  const { companyId } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await axios.get(`http://127.0.0.1:8000/company/${companyId}/dashboard/`);
        setData(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchDashboard();
  }, [companyId]);

  if (!data) return <p>Loading...</p>;

  return (
    <div>
      <h2>Company Dashboard</h2>
      <h3>{data.company.name}</h3>
      <p>Email: {data.company.email}</p>

      <h4>Packages</h4>
      <ul>
        {data.packages.map(pkg => (
          <li key={pkg.id}>
            {pkg.package_name} — {pkg.status} — ₹{pkg.price} — {pkg.duration_days} days
          </li>
        ))}
      </ul>

      <h4>Orders</h4>
      <ul>
        {data.orders.map(order => (
          <li key={order.id}>
            Order #{order.id} — Package {order.package_id} — {order.status} — {order.order_date}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Dashboard;
