import React, { useEffect, useState } from "react";
import axios from "axios";

function Orders() {
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await axios.get("http://127.0.0.1:8000/orders/"); 
        setOrders(res.data.orders);
      } catch (err) {
        console.error(err);
      }
    };
    fetchOrders();
  }, []);

  const activateOrder = async (packageId) => {
    try {
      const res = await axios.get(`http://127.0.0.1:8000/order/${packageId}/activate/`);
      alert(res.data.message);

      // refresh orders after activation
      const updated = orders.map(o =>
        o.package_id === packageId ? { ...o, status: "active" } : o
      );
      setOrders(updated);
    } catch (err) {
      console.error(err);
      alert("Activation failed!");
    }
  };

  return (
    <div>
      <h2>My Orders</h2>
      <ul>
        {orders.map(order => (
          <li key={order.id}>
            Order #{order.id} — Package {order.package_id} — Status: {order.status}
            {order.status === "pending" && (
              <button onClick={() => activateOrder(order.package_id)}>Activate</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Orders;
