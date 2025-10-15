"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface SysData {
  dates: string[]
  types: { order: number; code: string; name: string }[]
  genders: { order: number; code: string; name: string }[]
  weapons: { order: number; code: string; name: string }[]
}

interface FiltersProps {
  sysData: SysData
  selectedDate: string
  setSelectedDate: (date: string) => void
  selectedType: string
  setSelectedType: (type: string) => void
  selectedGender: string
  setSelectedGender: (gender: string) => void
  selectedWeapon: string
  setSelectedWeapon: (weapon: string) => void
}

export default function Filters({
  sysData,
  selectedDate,
  setSelectedDate,
  selectedType,
  setSelectedType,
  selectedGender,
  setSelectedGender,
  selectedWeapon,
  setSelectedWeapon,
}: FiltersProps) {
  if (!sysData) {
    return <div>Loading filters...</div>
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center">
        <span className="w-20 text-sm whitespace-nowrap">比赛日期:</span>
        <Select value={selectedDate} onValueChange={setSelectedDate}>
          <SelectTrigger className="w-[calc(100%-5rem)]">
            <SelectValue placeholder="选择日期" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            {sysData.dates?.map((date) => (
              <SelectItem key={date} value={date}>
                {date}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-start gap-1">
        <div className="flex items-center gap-0.5 flex-1">
          <span className="w-10 text-sm whitespace-nowrap">类型:</span>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-full min-w-[4rem]">
              <SelectValue placeholder="选择类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              {sysData.types?.map((type) => (
                <SelectItem key={`${type.code}-${type.name}`} value={type.code}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-0.5 flex-1">
          <span className="w-10 text-sm whitespace-nowrap">性别:</span>
          <Select value={selectedGender} onValueChange={setSelectedGender}>
            <SelectTrigger className="w-full min-w-[4rem]">
              <SelectValue placeholder="选择性别" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              {sysData.genders?.map((gender) => (
                <SelectItem key={`${gender.code}-${gender.name}`} value={gender.code}>
                  {gender.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-0.5 flex-1">
          <span className="w-10 text-sm whitespace-nowrap">剑种:</span>
          <Select value={selectedWeapon} onValueChange={setSelectedWeapon}>
            <SelectTrigger className="w-full min-w-[4rem]">
              <SelectValue placeholder="选择剑种" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              {sysData.weapons?.map((weapon) => (
                <SelectItem key={`${weapon.code}-${weapon.name}`} value={weapon.code}>
                  {weapon.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
