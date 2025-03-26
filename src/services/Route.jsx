import React from "react";
import { Polyline } from "@react-google-maps/api";

export default function Route({ routes }) {
  return (
    <>
      {Object.entries(routes).map(([mode, path]) => (
        <Polyline
          key={mode}
          path={path}
          options={{
            strokeColor: mode === "WALK" ? "red" : mode === "DRIVE" ? "blue" : "purple",
            strokeWeight: 4,
            strokeOpacity: 0.7,
          }}
        />
      ))}
    </>
  );
}
