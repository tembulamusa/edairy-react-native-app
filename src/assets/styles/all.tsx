import React from "react";
import { TouchableOpacity, Text } from "react-native";

interface DropdownItemProps {
  item: { label: string; value: any; disabled?: boolean };
  onPress: (item: any) => void;
}

export const renderDropdownItem = (props: DropdownItemProps) => {
  const { item, onPress } = props;

  return (
    <TouchableOpacity
      style={{
        padding: 12,
        backgroundColor: "white",
        opacity: item.disabled ? 0.4 : 1,
      }}
      onPress={() => onPress(item)} // 🔑 required
    >
      <Text style={{ color: item.disabled ? "#888" : "#000" }}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );
};

// export default renderDropdownItem;
